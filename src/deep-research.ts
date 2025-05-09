import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';
import axios from 'axios';

import { o3MiniModel, trimPrompt } from './ai/providers';
import { systemPrompt, reportPrompt, academicSearchRefinementPrompt, domainDetectionPrompt, subdomainDetectionPrompt, keywordGenerationPrompt } from './prompt';
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

// Initialize SerpAPI key for Google Scholar
const serpApiKey = process.env.SERPAPI_KEY ?? '';

// Function to translate text to English using AI
async function translateToEnglish(text: string): Promise<string> {
  try {
    log(`Translating text to English: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const res = await generateObject({
      model: o3MiniModel,
      system: "You are a professional translator. Translate the given text to English accurately while preserving the meaning. If the text is already in English, return it unchanged with a note saying 'ALREADY_ENGLISH'.",
      prompt: `Translate the following text to English: "${text}"`,
      schema: z.object({
        translation: z.string().describe('The English translation of the text'),
        isAlreadyEnglish: z.boolean().describe('Whether the original text is already in English'),
      }),
    });
    
    if (res.object.isAlreadyEnglish) {
      log(`Text is already in English, no translation needed`);
      return text;
    }
    
    log(`Translation completed: "${res.object.translation.substring(0, 50)}${res.object.translation.length > 50 ? '...' : ''}"`);
    return res.object.translation;
  } catch (error) {
    log(`Error translating text to English: ${error.message || 'Unknown error'}`);
    // Return original text if translation fails
    return text;
  }
}

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
  globalReferenceMapping,
}: {
  query: string;
  result: any;
  numLearnings?: number;
  numFollowUpQuestions?: number;
  globalReferenceMapping?: { mapping: Record<string, number>, nextIndex: number };
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
  log(`Found ${uniqueUrls.length} unique URLs out of ${urls.length} total URLs for query: "${query}"`);

  const uniqueIndexes = {};

  // Assign unique indexes to the URLs
  uniqueUrls.forEach((url, idx) => {
    if (globalReferenceMapping && globalReferenceMapping.mapping[url]) {
      // If URL already has a global reference number, use it
      uniqueIndexes[url] = globalReferenceMapping.mapping[url];
      log(`Reusing existing reference [${uniqueIndexes[url]}] for URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`);
    } else {
      // Otherwise assign a new index
      const newIndex = globalReferenceMapping
        ? (globalReferenceMapping.nextIndex + idx)
        : (idx + 1);
      uniqueIndexes[url] = newIndex;

      // Update global reference mapping if it exists
      if (globalReferenceMapping) {
        globalReferenceMapping.mapping[url] = newIndex;
        log(`Assigned new reference [${newIndex}] to URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`);
      }
    }
  });

  // Update contents with unique indexes
  const uniqueContents = contents.map(item => ({
    ...item,
    index: uniqueIndexes[item.url]
  }));

  log(`Created ${uniqueContents.length} contents with unique indexes`);

  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the search results for "${query}", extract ${numLearnings} detailed learnings. Each learning should be comprehensive and include specific examples, data points, or case studies when available. Focus on depth rather than breadth.

Also generate ${numFollowUpQuestions} follow-up questions that could deepen our understanding of areas that need more research.

The search results are:
${uniqueContents.map(item => `<r index="${item.index}">\n${item.content}\n</r>`).join('\n')}

IMPORTANT: For each learning, make sure to cite the source using the EXACT index number provided in the search results, using the format [X]. These reference numbers are GLOBAL across the entire research project - do not modify them or create your own numbering system.`,
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

  // Process generated learnings to ensure reference numbers are consistent
  const processedLearnings = res.object.learnings.map(learning => {
    let processedLearning = learning;

    // Find all reference numbers [X] and replace them
    const referenceRegex = /\[(\d+)\]/g;
    processedLearning = processedLearning.replace(referenceRegex, (match, localIndex) => {
      // Find the URL corresponding to this local reference number
      const url = uniqueUrls.find(url => uniqueIndexes[url] === Number(localIndex));
      if (url) {
        // Use the reference number from uniqueIndexes (which is already global)
        return `[${uniqueIndexes[url]}]`;
      }
      return match; // If no matching URL is found, keep the original
    });

    return processedLearning;
  });

  // Return the reference indexes mapping using the unique indexes
  return {
    ...res.object,
    learnings: processedLearnings, // Return processed learnings
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
  log(`Starting to write final report for prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  log(`Using ${learnings.length} learnings and ${visitedUrls.length} visited URLs`);
  log(`Reference mapping contains ${Object.keys(referenceMapping).length} entries`);

  const learningsString = trimPrompt(
    learnings
      .map(learning => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    200_000,
  );

  // Use the global reference mapping directly without renumbering
  // Create a references mapping string for the prompt
  const uniqueUrls = [...new Set(visitedUrls)];
  log(`Found ${uniqueUrls.length} unique URLs out of ${visitedUrls.length} total URLs for the final report`);

  // Check if any URLs are missing from the reference mapping
  const missingRefs = uniqueUrls.filter(url => !referenceMapping[url]);
  if (missingRefs.length > 0) {
    log(`WARNING: Found ${missingRefs.length} URLs without reference numbers. These will be assigned 0.`);
    if (missingRefs.length < 5) {
      log(`Missing reference URLs: ${missingRefs.join(', ')}`);
    } else {
      log(`Sample of missing reference URLs: ${missingRefs.slice(0, 3).join(', ')}...`);
    }
  }

  // Create a map to store citation formats for each URL
  const citationFormats = {};

  // Extract citation formats from Google Scholar results (if available)
  uniqueUrls.forEach(url => {
    // Check if this URL has citation data attached to it
    // This information would have been added during the searchGoogleScholar function
    const urlParts = url.split('#');
    if (urlParts.length > 1 && urlParts[1] === 'citations') {
      // This is a citation URL, extract the citation data
      try {
        const citationData = JSON.parse(urlParts[2]);
        if (citationData && citationData.formats) {
          citationFormats[url] = citationData;
          log(`Found citation formats for URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`);
        }
      } catch (e) {
        log(`Error parsing citation data for URL: ${url}`);
      }
    }
  });

  log(`Found citation formats for ${Object.keys(citationFormats).length} URLs`);

  const referencesMapping = uniqueUrls
    .map(url => {
      const refNumber = referenceMapping[url] || 0;
      const citation = citationFormats[url];

      // If we have citation formats, include the APA format (or first available format)
      if (citation && citation.formats && citation.formats.length > 0) {
        // Try to find APA format first
        const apaFormat = citation.formats.find(format => format.title === 'APA');
        const citationFormat = apaFormat || citation.formats[0]; // Use APA if available, otherwise use the first format

        // Extract the base URL without the citation data
        const baseUrl = url.split('#citations#')[0];

        // Return the citation with a markdown link for the URL
        return `[${refNumber}] ${citationFormat.snippet}\n   [Link](${baseUrl})`;
      }

      // Otherwise just return the URL as a markdown link
      return `[${refNumber}] [${url}](${url})`;
    })
    .sort((a, b) => {
      const indexA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
      const indexB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
      return indexA - indexB;
    })
    .join('\n');
  
  // Log reference statistics
  const refNumbers = uniqueUrls.map(url => referenceMapping[url] || 0);
  const validRefs = refNumbers.filter(num => num > 0);

  if (validRefs.length === 0) {
    log(`WARNING: No valid references found for the final report. The report will not contain citations.`);
    
    // Add a fallback reference to ensure the report has at least one reference
    log(`Adding a fallback reference to ensure the report has at least one reference.`);
    const fallbackUrl = `https://example.com/fallback?query=${encodeURIComponent(prompt)}`;
    referenceMapping[fallbackUrl] = 1;
    uniqueUrls.push(fallbackUrl);
    
    // Update validRefs
    validRefs.push(1);
    
    log(`Added fallback reference: [1] Research Notes on: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}\n   [Link](${fallbackUrl})`);
  }

  log(`Final report will include ${validRefs.length} valid references with numbers ranging from ${Math.min(...validRefs) || 0} to ${Math.max(...validRefs) || 0}`);

  if (validRefs.length === 0) {
    log(`WARNING: No valid references found for the final report. The report will not contain citations.`);
  }

  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: reportPrompt({
      prompt,
      learningsString,
      referencesMapping,
      language
    }),
    schema: z.object({
      reportMarkdown: z
        .string()
        .describe('Comprehensive final report on the topic in Markdown'),
    }),
  });

  log(`res:\n ${res.object.reportMarkdown} \n`)

  // Generate a references section using the same global reference mapping
  const urlsSection = `\n\n## References\n${uniqueUrls
    .map(url => {
      const refNumber = referenceMapping[url] || 0;
      const citation = citationFormats[url];

      // If we have citation formats, include the APA format (or first available format)
      if (citation && citation.formats && citation.formats.length > 0) {
        // Try to find APA format first
        const apaFormat = citation.formats.find(format => format.title === 'APA');
        const citationFormat = apaFormat || citation.formats[0]; // Use APA if available, otherwise use the first format

        // Extract the base URL without the citation data
        const baseUrl = url.split('#citations#')[0];

        // Return the citation with a markdown link for the URL
        return `[${refNumber}] ${citationFormat.snippet} [Link](${baseUrl})`;
      }

      // Otherwise just return the URL as a markdown link
      return `[${refNumber}] [${url}](${url})`;
    })
    .sort((a, b) => {
      const indexA = parseInt(a.match(/\[(\d+)\]/)?.[1] || '0');
      const indexB = parseInt(b.match(/\[(\d+)\]/)?.[1] || '0');
      return indexA - indexB;
    })
    .join('\n')}\n`;

  // Add a note about references to the report and ensure it ends with references
  let reportWithReferences = res.object.reportMarkdown;

  // Check if the generated report already contains references
  const hasReferencesSection = reportWithReferences.includes('## References');
  log(`Generated report ${hasReferencesSection ? 'already includes' : 'does not include'} a References section`);

  // Count references in the report
  const referencePattern = /\[(\d+)\]/g;
  const referencesInReport = [...reportWithReferences.matchAll(referencePattern)].map(match => parseInt(match[1]));
  const uniqueReferencesInReport = [...new Set(referencesInReport)];

  log(`Found ${referencesInReport.length} reference citations in the report (${uniqueReferencesInReport.length} unique reference numbers)`);

  if (referencesInReport.length === 0) {
    log(`WARNING: The generated report does not contain any reference citations.`);
  } else {
    log(`Reference numbers used in the report: ${uniqueReferencesInReport.sort((a, b) => a - b).join(', ')}`);
  }

  // Add references section if not already present
  if (!hasReferencesSection) {
    log(`Adding References section to the report`);
    reportWithReferences = reportWithReferences.trim();
    reportWithReferences = reportWithReferences.trim() + urlsSection;
  }

  log(`Final report generation completed with ${uniqueReferencesInReport.length} unique references cited`);

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
    resolve: () => { },
    report: '',
    partialResults: [],
  };

  const creditManager = await CreditManager.getInstance();
  let creditsUsed = 0;

  try {
    // 检查用户额度是否足够
    const hasEnoughCredits = await creditManager.checkUserCredits(userId, depth, breadth);
    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits to perform this research');
    }

    // 开始研究前扣除额度
    creditsUsed = await creditManager.deductCredits(userId, query, depth, breadth);

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

    // Initialize global reference mapping to track consistent reference numbers
    const referenceMapping = {};
    let nextGlobalIndex = 1;
    const globalReferenceMapping = {
      mapping: referenceMapping,
      nextIndex: nextGlobalIndex
    };

    log(`Initialized reference mapping system. Starting with empty mapping.`);

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
            log(`Skipping research for query: "${serpQuery.query}"`);
            continue;
          }
        } catch (error) {
          console.error('Error asking question:', error);
          // If there's an error asking the question, continue with the research
        }

        try {
          log(`Starting research for query: "${serpQuery.query}"`);

          // Initialize default empty results
          let webResult = { data: [] };
          let scholarResult = { data: [] };

          // Perform web search using Firecrawl
          try {
            webResult = await limit(() => firecrawl.search(serpQuery.query, {
              limit: process.env.FIRECRAWL_LIMIT,
              scrapeOptions: {
                formats: ["markdown"]
              }
            }));
            log(`Firecrawl search found ${webResult.data.length} results for query: "${serpQuery.query}"`);
            log(`Web results: ${JSON.stringify(webResult)}`);
          } catch (firecrawlError) {
            log(`Firecrawl search failed for query "${serpQuery.query}": ${firecrawlError instanceof Error ? firecrawlError.message : 'Unknown error'}`);
            log(`Continuing with empty web results. Will still attempt to use Google Scholar results.`);
            // Keep webResult.data as empty array and continue
          }

          // Perform Google Scholar search with original query
          try {
            // Search with original query
            scholarResult = await limit(() => searchGoogleScholar(serpQuery.query));
            log(`Google Scholar search found ${scholarResult.data.length} results for original query: "${serpQuery.query}"`);
            
            // Search with translated query (if needed)
            // Only translate if the language is not English
            if (language && language.toLowerCase() !== 'en' && language.toLowerCase() !== 'en-us') {
              log(`Language is ${language}, attempting to search with English translation`);
              
              try {
                const translatedScholarResult = await limit(() => 
                  searchGoogleScholar(serpQuery.query, { translateToEnglish: true })
                );
                
                const translatedResultCount = translatedScholarResult.data.length;
                log(`Google Scholar search found ${translatedResultCount} results for translated query`);
                
                if (translatedResultCount > 0) {
                  // Combine results, removing duplicates based on URL
                  const allScholarUrls = new Set(scholarResult.data.map(item => item.url));
                  const uniqueTranslatedResults = translatedScholarResult.data.filter(
                    item => !allScholarUrls.has(item.url)
                  );
                  
                  const uniqueCount = uniqueTranslatedResults.length;
                  if (uniqueCount > 0) {
                    log(`Found ${uniqueCount} unique results from translated query that weren't in original results`);
                    
                    // Add a marker to indicate these came from translated query
                    const markedTranslatedResults = uniqueTranslatedResults.map(result => ({
                      ...result,
                      fromTranslatedQuery: true,
                      originalQuery: serpQuery.query
                    }));
                    
                    // Combine with original results
                    scholarResult.data = [...scholarResult.data, ...markedTranslatedResults];
                    log(`Combined scholar results: ${scholarResult.data.length} total items (${scholarResult.data.length - uniqueCount} original + ${uniqueCount} from translation)`);
                  } else {
                    log(`No unique results found from translated query`);
                  }
                } else {
                  log(`No results found from translated query`);
                }
              } catch (translatedScholarError) {
                log(`Google Scholar search failed for translated query: ${translatedScholarError instanceof Error ? translatedScholarError.message : 'Unknown error'}`);
                log(`Continuing with only original language results.`);
              }
            } else {
              log(`Language is ${language}, skipping translation for Google Scholar search`);
            }

            // Process scholar results to include citation data in the URL
            scholarResult.data = scholarResult.data.map(result => {
              if (result.citations) {
                // Encode citation data in the URL for later use in the final report
                const citationData = {
                  formats: result.citations.formats,
                  links: result.citations.links
                };

                // Append citation data to URL with a special marker
                const citationJson = JSON.stringify(citationData);
                result.url = `${result.url}#citations#${citationJson}`;
                
                // Add note if this result came from a translated query
                const translationNote = result.fromTranslatedQuery ? 
                  ` (from translated query: "${result.originalQuery}")` : '';
                log(`Added citation data to URL${translationNote}: ${result.url.substring(0, 50)}...`);
              }
              return result;
            });
          } catch (scholarError) {
            log(`Google Scholar search failed for query "${serpQuery.query}": ${scholarError instanceof Error ? scholarError.message : 'Unknown error'}`);
            log(`Continuing with empty scholar results.`);
            // Keep scholarResult.data as empty array and continue
          }

          // Combine results from both sources
          const combinedResult = {
            data: [...webResult.data, ...scholarResult.data]
          };
          
          // Log combined results statistics
          const webCount = webResult.data.length;
          const scholarCount = scholarResult.data.length;
          const translatedCount = scholarResult.data.filter(item => item.fromTranslatedQuery).length;
          
          log(`Combined search results: ${combinedResult.data.length} total items for query: "${serpQuery.query}" (${webCount} web + ${scholarCount} scholar, including ${translatedCount} from translated query)`);

          // Skip processing if no results were found from either source
          if (combinedResult.data.length === 0) {
            log(`No results found from either Firecrawl or Google Scholar for query: "${serpQuery.query}". Skipping processing.`);
            
            // Add fallback content for this query to ensure we have some references
            log(`Adding fallback content for query: "${serpQuery.query}"`);
            
            // Create a fallback URL and content
            const fallbackUrl = `https://example.com/fallback?query=${encodeURIComponent(serpQuery.query)}`;
            const fallbackContent = {
              data: [{
                description: `This is fallback content for the query: "${serpQuery.query}". No results were found from either Firecrawl or Google Scholar.`,
                url: fallbackUrl,
                title: `Fallback content for: ${serpQuery.query}`
              }]
            };
            
            // Process the fallback content
            try {
              const fallbackProcessed = await processSerpResult({
                query: serpQuery.query,
                result: fallbackContent,
                globalReferenceMapping
              });
              
              log(`Processed fallback content for query "${serpQuery.query}"`);
              
              if (fallbackProcessed.learnings) {
                newLearnings.push(...fallbackProcessed.learnings);
              }
              if (fallbackProcessed.visitedUrls) {
                newVisitedUrls.push(...fallbackProcessed.visitedUrls);
              }
              if (fallbackProcessed.referenceIndexes) {
                Object.assign(referenceMapping, fallbackProcessed.referenceIndexes);
              }
            } catch (fallbackError) {
              log(`Failed to process fallback content: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
            }
            
            reportProgress({ completedQueries: progress.completedQueries + 1 });
            continue;
          }

          // Log reference mapping state before processing
          const refCountBefore = Object.keys(referenceMapping).length;
          log(`Reference mapping before processing query "${serpQuery.query}": ${refCountBefore} entries`);

          const processed = await processSerpResult({
            query: serpQuery.query,
            result: combinedResult,
            globalReferenceMapping
          });

          // Log detailed information about the processed results
          log(`Processed results for query "${serpQuery.query}":
  - Learnings: ${processed.learnings?.length || 0}
  - Visited URLs: ${processed.visitedUrls?.length || 0}
  - Reference indexes: ${Object.keys(processed.referenceIndexes || {}).length || 0}`);

          if (processed.learnings) {
            newLearnings.push(...processed.learnings);
          }
          if (processed.visitedUrls) {
            newVisitedUrls.push(...processed.visitedUrls);
          }
          // Store the reference index mapping from this search result
          if (processed.referenceIndexes) {
            const newReferences = Object.keys(processed.referenceIndexes).filter(url => !referenceMapping[url]);
            log(`Adding ${newReferences.length} new references to global mapping from query "${serpQuery.query}"`);

            if (newReferences.length > 0) {
              log(`New reference URLs added: ${newReferences.slice(0, 3).join(', ')}${newReferences.length > 3 ? ` and ${newReferences.length - 3} more...` : ''}`);
            }

            Object.assign(referenceMapping, processed.referenceIndexes);
          } else {
            log(`No reference indexes found in processed results for query "${serpQuery.query}"`);
          }

          reportProgress({ completedQueries: progress.completedQueries + 1 });
        } catch (error) {
          console.error('Error processing query:', serpQuery.query, error);
          log(`Failed to process query "${serpQuery.query}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Log the current state of the reference mapping
      const refUrls = Object.keys(referenceMapping);
      log(`Current reference mapping has ${refUrls.length} entries`);

      if (refUrls.length === 0) {
        log(`WARNING: No references found after depth ${currentDepth}/${depth}. This may affect the quality of the final report.`);
      } else {
        // Log a sample of the references
        const sampleSize = Math.min(3, refUrls.length);
        const refSample = refUrls.slice(0, sampleSize).map(url => `[${referenceMapping[url]}] ${url}`);
        log(`Reference sample (${sampleSize}/${refUrls.length}): ${refSample.join(', ')}${refUrls.length > sampleSize ? ` and ${refUrls.length - sampleSize} more...` : ''}`);
      }

      // Save partial results to session
      session.partialResults = [...results, {
        learnings: [...new Set(newLearnings)],
        visitedUrls: [...new Set(newVisitedUrls)],
        referenceMapping
      }];
    }

    // Log final reference statistics
    const finalRefCount = Object.keys(referenceMapping).length;
    log(`Research completed with ${finalRefCount} total references collected.`);

    if (finalRefCount === 0) {
      log(`WARNING: No references were collected during the entire research process. The final report will not contain citations.`);
    } else {
      log(`References will be included in the final report with consistent global numbering.`);
    }

    return session.partialResults;
  } catch (error: unknown) {
    // If any error occurs during the research process, refund the credits
    if (creditsUsed > 0) {
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`Research failed with error: ${errorMessage}. Refunding ${creditsUsed} credits to user ${userId}.`);
        await creditManager.refundCredits(
          userId, 
          query, 
          depth, 
          breadth, 
          `Research failed: ${errorMessage}`
        );
        log(`Successfully refunded ${creditsUsed} credits to user ${userId}.`);
      } catch (refundError: unknown) {
        const refundErrorMessage = refundError instanceof Error ? refundError.message : 'Unknown error';
        log(`ERROR: Failed to refund credits to user ${userId}: ${refundErrorMessage}`);
        console.error('Failed to refund credits:', refundError);
      }
    }
    
    // Re-throw the original error so the caller can handle it
    throw error;
  }
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

// Function to search Google Scholar using SerpAPI
async function searchGoogleScholar(query: string, options: { translateToEnglish?: boolean } = {}): Promise<any> {
  if (!serpApiKey) {
    log('SerpAPI key not found. Skipping Google Scholar search.');
    return { data: [] };
  }

  try {
    // If translation is requested
    let searchQuery = query;
    let isTranslated = false;
    let isRefined = false;
    let originalQuery = query;
    
    if (options.translateToEnglish) {
      try {
        const translatedQuery = await translateToEnglish(query);
        
        // Only use translation if it's different from the original
        if (translatedQuery !== query) {
          searchQuery = translatedQuery;
          isTranslated = true;
          log(`Using translated query for Google Scholar: "${searchQuery}"`);
        } else {
          log(`Query appears to be already in English or translation returned same text`);
        }
      } catch (translationError) {
        log(`Error during query translation: ${translationError instanceof Error ? translationError.message : 'Unknown error'}`);
        // Continue with original query if translation fails
      }
    }

    // Refine the query for academic search using AI
    try {
      log(`Refining query for academic search: "${searchQuery}"`);
      const refinedQuery = await refineQueryForAcademicSearch(searchQuery);
      
      if (refinedQuery && refinedQuery !== searchQuery) {
        log(`Original query: "${searchQuery}" refined to: "${refinedQuery}"`);
        searchQuery = refinedQuery;
        isRefined = true;
      } else {
        log(`Query refinement returned same or empty result, keeping original query`);
      }
    } catch (refinementError) {
      log(`Error during query refinement: ${refinementError instanceof Error ? refinementError.message : 'Unknown error'}`);
      // Continue with original or translated query if refinement fails
    }

    // Detect domain and add relevant academic keywords
    let domainSpecificQuery = searchQuery;
    let domainKeywords = '';
    
    try {
      const { domain, keywords } = await detectDomainAndGetKeywords(searchQuery);
      if (keywords && keywords.length > 0) {
        domainKeywords = keywords;
        domainSpecificQuery = `${searchQuery} ${keywords}`;
        log(`Added domain-specific keywords for ${domain}: "${keywords}"`);
      }
    } catch (domainError) {
      log(`Error detecting domain or getting keywords: ${domainError instanceof Error ? domainError.message : 'Unknown error'}`);
      // Continue with refined or original query if domain detection fails
    }

    log(`Searching Google Scholar for: ${domainSpecificQuery}${isRefined ? ' (refined from: ' + originalQuery + ')' : ''}${isTranslated ? ' (translated from: ' + query + ')' : ''}${domainKeywords ? ' with domain keywords: ' + domainKeywords : ''}`);
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: domainSpecificQuery,
        api_key: serpApiKey,
        num: process.env.SERPAPI_LIMIT,
      },
    });

    // Process the response to match the format expected by processSerpResult
    const organicResults = response.data.organic_results || [];

    // Fetch citation formats for each result
    const resultsWithCitations = await Promise.all(
      organicResults.map(async (result: any) => {
        let citations = null;

        // Get the result_id from the result
        const resultId = result.result_id || (result.inline_links?.serpapi_cite_link ?
          new URL(result.inline_links.serpapi_cite_link).searchParams.get('q') : null);

        if (resultId) {
          try {
            log(`Fetching citation formats for result: ${result.title}`);
            const citeResponse = await axios.get('https://serpapi.com/search', {
              params: {
                engine: 'google_scholar_cite',
                q: resultId,
                api_key: serpApiKey,
                num: process.env.SERPAPI_LIMIT,
              },
            });

            citations = {
              formats: citeResponse.data.citations || [],
              links: citeResponse.data.links || []
            };

            log(`Successfully retrieved ${citations.formats.length} citation formats and ${citations.links.length} citation links for "${result.title}"`);
          } catch (citeError) {
            log(`Error fetching citation formats for "${result.title}": ${citeError instanceof Error ? citeError.message : 'Unknown error'}`);
          }
        } else {
          log(`No result_id or serpapi_cite_link found for "${result.title}", cannot fetch citation formats`);
        }

        return {
          url: result.link || '',
          title: result.title || '',
          description: `${result.title || ''}\n\n${result.publication_info?.summary || ''}\n\n${result.snippet || ''}\n\nAuthors: ${result.publication_info?.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}\n\nCited by: ${result.inline_links?.cited_by?.total || 0} papers`,
          citations: citations,
          // Add flags to indicate query modifications
          fromTranslatedQuery: isTranslated,
          fromRefinedQuery: isRefined,
          domainKeywordsAdded: !!domainKeywords
        };
      })
    );

    const formattedResults = {
      data: resultsWithCitations,
    };

    log(`Google Scholar search found ${formattedResults.data.length} results for "${domainSpecificQuery}"${isRefined ? ' (refined from: ' + originalQuery + ')' : ''}${isTranslated ? ' (translated from: ' + query + ')' : ''}${domainKeywords ? ' with domain keywords: ' + domainKeywords : ''}`);

    if (formattedResults.data.length === 0) {
      log(`WARNING: No Google Scholar results found for query: "${domainSpecificQuery}"${isRefined ? ' (refined from: ' + originalQuery + ')' : ''}${isTranslated ? ' (translated from: ' + query + ')' : ''}${domainKeywords ? ' with domain keywords: ' + domainKeywords : ''}. This may affect academic references.`);
    } else {
      // Log sample of scholar results
      const sampleSize = Math.min(2, formattedResults.data.length);
      log(`Scholar result sample: ${formattedResults.data.slice(0, sampleSize).map(r => r.title).join(', ')}${formattedResults.data.length > sampleSize ? ` and ${formattedResults.data.length - sampleSize} more...` : ''}`);

      // Log citation information
      const resultsWithCitationCount = formattedResults.data.filter(r => r.citations && r.citations.formats && r.citations.formats.length > 0).length;
      log(`Retrieved citation formats for ${resultsWithCitationCount} out of ${formattedResults.data.length} results`);
    }

    return formattedResults;
  } catch (error) {
    log(`Error searching Google Scholar for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { data: [] };
  }
}

/**
 * Refines a search query to be more suitable for academic search using AI
 * Makes the query more specific and academic-oriented
 */
async function refineQueryForAcademicSearch(query: string): Promise<string> {
  try {
    // Use the AI model to refine the query
    const refinedQuery = await callAI(academicSearchRefinementPrompt(query), 'query-refinement');
    
    // Clean up the response - remove quotes, newlines and extra spaces
    const cleanedQuery = refinedQuery.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    
    return cleanedQuery || query; // Return original if refinement is empty
  } catch (error) {
    log(`Error refining query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return query; // Return original query on error
  }
}

/**
 * Detects the academic domain of a query and returns relevant keywords for top journals/conferences
 * @param query The search query
 * @returns Object containing detected domain and keywords to append
 */
async function detectDomainAndGetKeywords(query: string): Promise<{ domain: string, keywords: string }> {
  try {
    // First, detect the domain using AI
    const domain = await callAI(domainDetectionPrompt(query), 'domain-detection');
    const cleanDomain = domain.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    
    // Domain-specific keywords for top journals and conferences
    const domainKeywords: Record<string, string> = {
      'Computer Science': 'IEEE ACM CVPR ICCV ECCV NeurIPS ICML',
      'Computer Vision': 'CVPR ICCV ECCV SIGGRAPH WACV',
      'Machine Learning': 'NeurIPS ICML ICLR JMLR TPAMI',
      'Natural Language Processing': 'ACL EMNLP NAACL CoNLL',
      'Artificial Intelligence': 'AAAI IJCAI AI',
      'Electrical Engineering': 'IEEE Transactions',
      'Physics': 'Physical Review Nature Physics',
      'Mathematics': 'Journal of Mathematics',
      'Biology': 'Nature Cell Biology',
      'Medicine': 'NEJM Lancet BMJ',
      'Chemistry': 'Journal of American Chemical Society',
      'Economics': 'American Economic Review',
      'Psychology': 'Journal of Experimental Psychology',
      'Social Sciences': 'Social Science Research',
      'Environmental Science': 'Environmental Science & Technology',
      'Materials Science': 'Advanced Materials',
      'Mechanical Engineering': 'Journal of Mechanical Design',
      'Civil Engineering': 'Journal of Structural Engineering'
    };

    // Get more specific subdomain for better keyword matching
    const subdomain = await callAI(subdomainDetectionPrompt(query, cleanDomain), 'subdomain-detection');
    const cleanSubdomain = subdomain.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    
    // Try to get keywords for the subdomain first, then fall back to the main domain
    let keywords = domainKeywords[cleanSubdomain] || domainKeywords[cleanDomain] || '';
    
    // If no predefined keywords, try to generate some using AI
    if (!keywords && (cleanDomain !== 'Other' && !cleanDomain.includes('Other'))) {
      keywords = await callAI(keywordGenerationPrompt(cleanSubdomain || cleanDomain), 'keyword-generation');
      keywords = keywords.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    }
    
    return { domain: cleanSubdomain || cleanDomain, keywords };
  } catch (error) {
    log(`Error detecting domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { domain: 'Unknown', keywords: '' };
  }
}

/**
 * Helper function to call AI model with a prompt
 * Reuses the existing AI model used elsewhere in the application
 */
async function callAI(prompt: string, purpose: string): Promise<string> {
  try {
    // Check if we have an AI model configured
    if (!openaiApiKey) {
      log(`No OpenAI API key found. Cannot perform ${purpose}.`);
      return '';
    }
    
    // Use the existing AI model configuration
    const configuration = new Configuration({
      apiKey: openaiApiKey,
    });
    const openai = new OpenAIApi(configuration);
    
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful academic research assistant that provides concise, direct answers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more deterministic responses
      max_tokens: 100,  // Limit token usage since we only need short responses
    });
    
    return response.data.choices[0]?.message?.content || '';
  } catch (error) {
    log(`AI call error (${purpose}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    return '';
  }
}

export interface ResearchSession {
  output: OutputManager;
  resolve: (answer: string) => void;
  report: string;
  partialResults: ResearchResult[];
}
