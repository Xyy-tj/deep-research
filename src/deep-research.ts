import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { o3MiniModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';
import { OutputManager } from './output-manager';
import { CreditManager } from './user/credit-manager';

// Initialize output manager for coordinated console/progress output
const output = new OutputManager();

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  creditsUsed?: number;
};

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
  referenceMapping?: Record<string, number>;
};

// Get concurrency limit from environment variable, default to 2 if not set
const ConcurrencyLimit = Number(process.env.CONCURRENCY_LIMIT ?? 2);

// Get question timeout from environment variable, default to 3000ms if not set
const QuestionTimeoutMs = Number(process.env.QUESTION_TIMEOUT_MS ?? 3000);

// Initialize Firecrawl with optional API key and optional base url

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
}) {
  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${learnings
      ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
        '\n',
      )}`
      : ''
      }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  log(
    `Created ${res.object.queries.length} queries`,
    res.object.queries,
  );

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  query: string;
  result: any;
  numLearnings?: number;
  numFollowUpQuestions?: number;
}) {
  const contents = compact(result.data.map((item, index) => ({
    content: trimPrompt(item.description, 25_000),
    url: item.url,
    index: index + 1
  })).filter(item => item.content));
  
  log(`Ran ${query}, found ${contents.length} contents`);

  if (contents.length === 0) {
    log(`No results found for query: ${query}`);
    return {
      learnings: [],
      visitedUrls: [],
      followUpQuestions: [],
      referenceIndexes: {}
    };
  }

  // Ensure unique indexes for this batch of search results
  const urls = contents.map(item => item.url);
  const uniqueUrls = [...new Set(urls)];
  const uniqueIndexes = {};
  
  // Assign unique indexes to the URLs
  uniqueUrls.forEach((url, idx) => {
    uniqueIndexes[url] = idx + 1;
  });
  
  // Update contents with unique indexes
  const uniqueContents = contents.map(item => ({
    ...item,
    index: uniqueIndexes[item.url]
  }));

  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the search results for "${query}", extract ${numLearnings} detailed learnings. Each learning should be comprehensive and include specific examples, data points, or case studies when available. Focus on depth rather than breadth.

Also generate ${numFollowUpQuestions} follow-up questions that could deepen our understanding of areas that need more research.

The search results are:
${uniqueContents.map(item => `<r index="${item.index}">\n${item.content}\n</r>`).join('\n')}

IMPORTANT: For each learning, make sure to cite the source using the index number provided in the search results, using the format [X].`,
    schema: z.object({
      learnings: z
        .array(z.string())
        .describe('Detailed learnings extracted from the search results. Each learning should be a comprehensive paragraph with source citations.'),
      followUpQuestions: z
        .array(z.string())
        .describe('Follow-up questions for deeper research'),
    }),
  });
  
  log(
    `Created ${res.object.learnings.length} learnings`,
    res.object.learnings,
  );

  // Return the reference indexes mapping using the unique indexes
  return {
    ...res.object,
    visitedUrls: uniqueUrls,
    referenceIndexes: uniqueIndexes
  };
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  language = 'zh-CN',
  referenceMapping = {}
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
  language?: string;
  referenceMapping?: Record<string, number>;
}) {
  const learningsString = trimPrompt(
    learnings
      .map(learning => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    200_000,
  );

  // Create a unique reference mapping
  const uniqueUrls = [...new Set(visitedUrls)];
  const uniqueReferenceMapping = {};
  
  // First, try to use original reference numbers from the mapping if available
  const usedNumbers = new Set<number>();
  
  // First pass - preserve original numbers where possible
  uniqueUrls.forEach(url => {
    const originalNumber = referenceMapping[url];
    if (originalNumber && !usedNumbers.has(originalNumber)) {
      uniqueReferenceMapping[url] = originalNumber;
      usedNumbers.add(originalNumber);
    }
  });
  
  // Second pass - assign new unique numbers to remaining URLs
  let nextNumber = 1;
  uniqueUrls.forEach(url => {
    if (!uniqueReferenceMapping[url]) {
      // Find the next available number
      while (usedNumbers.has(nextNumber)) {
        nextNumber++;
      }
      uniqueReferenceMapping[url] = nextNumber;
      usedNumbers.add(nextNumber);
    }
  });
  
  // Create the references mapping string for the prompt
  const referencesMapping = uniqueUrls
    .map(url => `[${uniqueReferenceMapping[url]}] ${url}`)
    .sort((a, b) => {
      const indexA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
      const indexB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
      return indexA - indexB;
    })
    .join('\n');

  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, write a comprehensive and detailed report on the topic using the learnings from research. The report should be thorough, well-structured, and academically rigorous.

Required sections:
1. Executive Summary
2. Introduction and Background
3. Key Findings and Analysis
4. Detailed Discussion
   - Include specific examples and case studies
   - Provide data and evidence where available
   - Address different perspectives and approaches
5. Implications and Impact Analysis
6. Recommendations and Future Directions
7. Conclusion

Guidelines:
- Aim for at least 5 pages of detailed content
- Include ALL relevant learnings from the research
- Support claims with specific examples and data points
- IMPORTANT: When citing information from sources, use reference numbers in square brackets [X] that correspond to the references provided below
- Each major claim or finding should be supported by at least one reference
- Provide actionable insights and recommendations
- Use clear section headings and subheadings
- Maintain a professional and analytical tone
- IMPORTANT: Write the entire report in ${language === 'zh-CN' ? 'Chinese (Simplified)' : language} language

<prompt>${prompt}</prompt>

Here are all the learnings from previous research. Each learning includes reference numbers in square brackets that you should use in your report:

<learnings>
${learningsString}
</learnings>

Here are the references to use in your citations:
${referencesMapping}

Note: Make sure to use the reference numbers in square brackets [X] consistently throughout the report when citing information from sources. Each citation should correspond to the reference numbers provided above.`,
    schema: z.object({
      reportMarkdown: z
        .string()
        .describe('Comprehensive final report on the topic in Markdown'),
    }),
  });

  // Generate a references section that maintains unique reference numbers
  const urlsSection = `\n\n## References\n${uniqueUrls
    .map(url => `[${uniqueReferenceMapping[url]}] ${url}`)
    .sort((a, b) => {
      const indexA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
      const indexB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
      return indexA - indexB;
    })
    .join('\n')}\n`;
  
  // Add a note about references to the report and ensure it ends with references
  let reportWithReferences = res.object.reportMarkdown;
  if (!reportWithReferences.includes('## References')) {
    reportWithReferences = reportWithReferences.trim() + urlsSection;
  }
  
  return reportWithReferences;
}

export async function deepResearch({
  query,
  breadth,
  depth,
  output,
  userId,
  language = 'zh-CN',
  learnings = [],
  visitedUrls = [],
  onProgress,
}: {
  query: string;
  breadth: number;
  depth: number;
  output: any;
  userId: string;
  language?: string;
  learnings?: string[];
  visitedUrls?: string[];
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];
  const session: ResearchSession = {
    output,
    resolve: () => {},
    report: '',
    partialResults: [],
  };

  const creditManager = await CreditManager.getInstance();

  // 检查用户额度是否足够
  const hasEnoughCredits = await creditManager.checkUserCredits(userId, depth, breadth);
  if (!hasEnoughCredits) {
    throw new Error('Insufficient credits to perform this research');
  }

  // 开始研究前扣除额度
  const creditsUsed = await creditManager.deductCredits(userId, query, depth, breadth);

  log(`Starting deep research with depth ${depth} and breadth ${breadth}`);
  log(`Credits used: ${creditsUsed}`);

  const progress: ResearchProgress = {
    currentDepth: 0,
    totalDepth: depth,
    currentBreadth: 0,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
    creditsUsed,
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  // Generate initial SERP queries
  const serpQueries = await generateSerpQueries({
    query,
    numQueries: breadth,
    learnings,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query
  });

  // Process each query
  const limit = pLimit(ConcurrencyLimit);
  const newLearnings = [...learnings];
  const newVisitedUrls = [...visitedUrls];
  // Track consistent reference indexes across all search results
  const referenceMapping = {};

  for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
    reportProgress({ currentDepth });

    for (let i = 0; i < serpQueries.length; i++) {
      const serpQuery = serpQueries[i];
      reportProgress({
        currentBreadth: i + 1,
        currentQuery: serpQuery.query,
      });

      // Ask user if they want to research this query
      try {
        const shouldResearch = await askQuestionWithTimeout(
          output,
          `Would you like to research more about: ${serpQuery.query}?`,
          QuestionTimeoutMs
        );

        if (!shouldResearch) {
          reportProgress({ completedQueries: progress.completedQueries + 1 });
          continue;
        }
      } catch (error) {
        console.error('Error asking question:', error);
        // If there's an error asking the question, continue with the research
      }

      try {
        const result = await limit(() => firecrawl.search(serpQuery.query, {
          scrapeOptions: {
            formats: ["markdown"]
          }
        }));
        const processed = await processSerpResult({
          query: serpQuery.query,
          result,
        });

        if (processed.learnings) {
          newLearnings.push(...processed.learnings);
        }
        if (processed.visitedUrls) {
          newVisitedUrls.push(...processed.visitedUrls);
        }
        // Store the reference index mapping from this search result
        if (processed.referenceIndexes) {
          Object.assign(referenceMapping, processed.referenceIndexes);
        }

        reportProgress({ completedQueries: progress.completedQueries + 1 });
      } catch (error) {
        console.error('Error processing query:', serpQuery.query, error);
        reportProgress({ completedQueries: progress.completedQueries + 1 });
      }
    }

    // Generate follow-up queries for the next depth level
    if (currentDepth < depth) {
      const followUpQueries = await generateSerpQueries({
        query,
        numQueries: breadth,
        learnings: newLearnings,
      });

      serpQueries.length = 0;
      serpQueries.push(...followUpQueries);

      reportProgress({
        totalQueries: progress.totalQueries + followUpQueries.length,
        currentQuery: followUpQueries[0]?.query,
      });
    }

    // 保存部分结果到会话
    session.partialResults = [...results, {
      learnings: [...new Set(newLearnings)],
      visitedUrls: [...new Set(newVisitedUrls)],
      referenceMapping
    }];
  }

  return session.partialResults;
}

// Function to ask question with timeout
async function askQuestionWithTimeout(output: any, question: string, timeoutMs: number): Promise<boolean> {
  try {
    const answer = await Promise.race([
      output.askQuestion(question),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
      )
    ]);
    return answer.toLowerCase() === 'yes';
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMEOUT') {
      console.log(`Question timed out after ${timeoutMs}ms, proceeding with default 'yes'`);
      return true;
    }
    throw error;
  }
}

export interface ResearchSession {
  output: OutputManager;
  resolve: (answer: string) => void;
  report: string;
  partialResults: ResearchResult[];
}
