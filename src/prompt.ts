export const systemPrompt = () => {
  const now = new Date().toISOString();
  return `You are an expert researcher. Today is ${now}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.`;
};

export const reportPrompt = ({
  prompt,
  learningsString,
  referencesMapping,
  language
}: {
  prompt: string;
  learningsString: string;
  referencesMapping: string;
  language: string;
}) => {
  return `Given the following prompt from the user, write a comprehensive and detailed report on the topic using the learnings from research. The report should be thorough, well-structured, and academically rigorous.

Required sections:
1. Executive Abstract
   - Provide a concise but comprehensive overview of the entire report
   - Highlight key findings and their significance

2. Introduction and Background
   - Provide extensive context about the topic's history and significance
   - Explain why this topic matters and to whom
   - Define all key terms and concepts thoroughly
   - Include at least 2-3 paragraphs of detailed background information

3. Key Findings and Analysis
   - Present each major finding in its own paragraph with supporting evidence, key conclution should be bold
   - Include at least 3-5 distinct findings with detailed explanations
   - Compare and contrast different findings when relevant

4. Detailed Discussion
   - Dedicate 1-3 paragraphs to each subtopic
   - Include specific examples and case studies with detailed descriptions
   - Provide comprehensive data and evidence for each point
   - Address different perspectives and approaches with in-depth analysis
   - Explore nuances and complexities of each subtopic
   - Include at least 5-12 paragraphs of detailed discussion

5. Implications and Impact Analysis
   - Examine impacts across different domains (economic, social, technological, etc.)
   - Include specific scenarios and their potential outcomes
   - Provide at least 2-4 paragraphs of detailed impact analysis

6. Recommendations and Future Directions
   - Provide specific, actionable recommendations with implementation details
   - Explain the rationale behind each recommendation
   - Discuss potential challenges and how to overcome them
   - Outline future research directions with specific questions to explore
   - Include at least 2-4 detailed recommendations

7. Conclusion
   - Synthesize key points from the report, emphasize the most important insights and their significance
   - End with thought-provoking implications

Guidelines:
- Aim for at least 8+ pages of detailed content (approximately 4000+ words)
- Include ALL relevant learnings from the research
- Support claims with specific examples and data points
- IMPORTANT: When citing information from sources, use reference numbers in square brackets [X] that correspond to the references provided below
- CRITICAL: Maintain CONSISTENT global reference numbers throughout the entire document. DO NOT restart numbering in each section.
- Each major claim or finding should be supported by at least one reference
- Provide actionable insights and recommendations
- Use clear section headings and subheadings
- Maintain a professional and analytical tone
- Avoid generalizations and vague statements - be specific and detailed
- Expand on each point with examples, evidence, and analysis
- IMPORTANT: Write the entire report in ${language === 'zh-CN' ? 'Chinese (Simplified)' : language} language

<prompt>${prompt}</prompt>

Here are all the learnings from previous research. Each learning includes reference numbers in square brackets that you should use in your report:

<learnings>
${learningsString}
</learnings>

Here are the references to use in your citations, but don't add reference at the end of the report:
${referencesMapping}

Note: Make sure to use the reference numbers in square brackets [X] consistently throughout the report when citing information from sources. Each citation should correspond to the reference numbers provided above. DO NOT restart numbering in each section - use the exact same reference numbers throughout the entire document.`;
};

export const academicSearchRefinementPrompt = (query: string) => {
  return `
You are an academic research assistant helping to refine search queries for Google Scholar.
Please refine the following query to make it more suitable for academic search:
"${query}"

Your refinement should:
1. Make the query more specific and focused on academic concepts
2. Use precise academic terminology
3. Remove colloquial language
4. Structure the query to match academic paper titles or keywords
5. Do NOT add specific journal names or conferences (these will be added separately)
6. Keep the refined query concise (under 10 words if possible)

Return ONLY the refined query text with no additional explanation.
`;
};

export const domainDetectionPrompt = (query: string) => {
  return `
Analyze this research query and determine which academic domain it belongs to.
Query: "${query}"

Choose ONE domain from this list:
- Computer Science
- Electrical Engineering
- Physics
- Mathematics
- Biology
- Medicine
- Chemistry
- Economics
- Psychology
- Social Sciences
- Environmental Science
- Materials Science
- Mechanical Engineering
- Civil Engineering
- Other (specify)

Return ONLY the domain name with no additional explanation.
`;
};

export const subdomainDetectionPrompt = (query: string, domain: string) => {
  return `
Based on this research query: "${query}"
And the general domain: "${domain}"

Determine a more specific subdomain. For example:
- If Computer Science, specify: Computer Vision, Machine Learning, Natural Language Processing, etc.
- If Medicine, specify: Cardiology, Neurology, Oncology, etc.

Return ONLY the specific subdomain with no additional explanation.
`;
};

export const keywordGenerationPrompt = (domain: string) => {
  return `
Generate 3-5 keywords representing top journals or conferences in the field of ${domain}.
These should be abbreviations or short names commonly used in academic citations.
For example, for Computer Vision: "CVPR ICCV ECCV"
For Electrical Engineering: "IEEE Transactions"

Return ONLY the keywords separated by spaces with no additional explanation.
`;
};
