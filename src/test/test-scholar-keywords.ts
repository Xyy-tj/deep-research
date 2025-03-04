import axios from 'axios';
import { generateObject } from 'ai';
import { z } from 'zod';
import { o3MiniModel } from '../ai/providers';

// Get SerpAPI key from environment variables
const serpApiKey = process.env.SERPAPI_KEY ?? '';

/**
 * Function to translate text to English using AI
 * This is a copy of the function in deep-research.ts
 */
async function translateToEnglish(text: string): Promise<string> {
  try {
    console.log(`Translating text to English: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
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
      console.log(`Text is already in English, no translation needed`);
      return text;
    }
    
    console.log(`Translation completed: "${res.object.translation.substring(0, 50)}${res.object.translation.length > 50 ? '...' : ''}"`);
    return res.object.translation;
  } catch (error) {
    console.error(`Error translating text to English: ${error.message || 'Unknown error'}`);
    // Return original text if translation fails
    return text;
  }
}

/**
 * Function to search Google Scholar using SerpAPI
 * This is a simplified version of the function in deep-research.ts
 */
async function searchGoogleScholar(query: string, options: { translateToEnglish?: boolean } = {}): Promise<any> {
  if (!serpApiKey) {
    console.log('SerpAPI key not found. Please set SERPAPI_KEY in your .env.local file.');
    return { data: [] };
  }

  try {
    // If translation is requested
    let searchQuery = query;
    let isTranslated = false;
    
    if (options.translateToEnglish) {
      try {
        const translatedQuery = await translateToEnglish(query);
        
        // Only use translation if it's different from the original
        if (translatedQuery !== query) {
          searchQuery = translatedQuery;
          isTranslated = true;
          console.log(`Using translated query for Google Scholar: "${searchQuery}"`);
        } else {
          console.log(`Query appears to be already in English or translation returned same text`);
        }
      } catch (translationError) {
        console.error(`Error during query translation: ${translationError.message || 'Unknown error'}`);
        // Continue with original query if translation fails
      }
    }

    console.log(`Searching Google Scholar for: ${searchQuery}${isTranslated ? ' (translated from: ' + query + ')' : ''}`);
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: searchQuery,
        api_key: serpApiKey,
      },
    });

    // Process the response to match the format expected by processSerpResult
    const organicResults = response.data.organic_results || [];

    const formattedResults = {
      data: organicResults.map((result: any) => ({
        url: result.link || '',
        title: result.title || '',
        description: `${result.title || ''}\n\n${result.publication_info?.summary || ''}\n\n${result.snippet || ''}\n\nAuthors: ${result.publication_info?.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}\n\nCited by: ${result.inline_links?.cited_by?.total || 0} papers`,
        fromTranslatedQuery: isTranslated,
        originalQuery: isTranslated ? query : undefined,
        translatedQuery: isTranslated ? searchQuery : undefined
      })),
      query: searchQuery,
      originalQuery: query,
      isTranslated
    };

    return formattedResults;
  } catch (error) {
    console.error(`Error searching Google Scholar for "${query}": ${error.message || 'Unknown error'}`);
    return { data: [] };
  }
}

/**
 * Function to generate SERP queries based on a user query
 * Simplified version of the function in deep-research.ts
 */
async function generateSerpQueries(query: string, numQueries = 3): Promise<string[]> {
  try {
    console.log(`Generating SERP queries for: "${query}"`);
    
    const res = await generateObject({
      model: o3MiniModel,
      system: "You are a research assistant helping to generate effective search queries for academic research.",
      prompt: `Given the following research topic, generate a list of ${numQueries} search queries that would be effective for finding relevant academic papers and information. Each query should explore a different aspect of the topic and be formulated to get the best search results: "${query}"`,
      schema: z.object({
        queries: z
          .array(z.string())
          .describe(`List of search queries, max of ${numQueries}`),
      }),
    });
    
    console.log(`Generated ${res.object.queries.length} queries`);
    return res.object.queries.slice(0, numQueries);
  } catch (error) {
    console.error(`Error generating SERP queries: ${error.message || 'Unknown error'}`);
    return [query]; // Return the original query if generation fails
  }
}

/**
 * Test function to show all keywords used for Google Scholar searches
 */
async function testScholarKeywords() {
  try {
    console.log('=== Testing Google Scholar Keywords ===');
    
    // Get user input from command line arguments
    const userQuery = process.argv[2] || '中国镁矿产量研究';
    
    console.log(`\nInput topic: "${userQuery}"`);
    
    // Step 1: Generate SERP queries from the user topic
    console.log('\n=== Step 1: Generating search queries from topic ===');
    const serpQueries = await generateSerpQueries(userQuery);
    
    console.log('\nGenerated search queries:');
    serpQueries.forEach((query, index) => {
      console.log(`${index + 1}. ${query}`);
    });
    
    // Step 2: For each SERP query, show both original and translated keywords
    console.log('\n=== Step 2: Testing each query with original and translated keywords ===');
    
    const allResults = [];
    
    for (const query of serpQueries) {
      console.log(`\n--- Processing query: "${query}" ---`);
      
      // Search with original query
      console.log('\nSearching with original query:');
      const originalResults = await searchGoogleScholar(query);
      console.log(`Found ${originalResults.data.length} results for original query: "${originalResults.query}"`);
      
      // Search with translated query (if needed)
      console.log('\nSearching with translated query:');
      const translatedResults = await searchGoogleScholar(query, { translateToEnglish: true });
      
      if (translatedResults.isTranslated) {
        console.log(`Found ${translatedResults.data.length} results for translated query: "${translatedResults.query}"`);
      } else {
        console.log('No translation was performed (query appears to be in English already)');
      }
      
      // Combine unique results
      const allUrls = new Set();
      const combinedResults = [];
      
      // Add original results
      originalResults.data.forEach(result => {
        if (!allUrls.has(result.url)) {
          allUrls.add(result.url);
          combinedResults.push(result);
        }
      });
      
      // Add translated results (if different from original)
      if (translatedResults.isTranslated) {
        translatedResults.data.forEach(result => {
          if (!allUrls.has(result.url)) {
            allUrls.add(result.url);
            combinedResults.push(result);
          }
        });
      }
      
      console.log(`\nCombined unique results: ${combinedResults.length}`);
      
      // Add to all results
      allResults.push({
        query,
        originalQuery: originalResults.query,
        translatedQuery: translatedResults.isTranslated ? translatedResults.query : null,
        originalResultCount: originalResults.data.length,
        translatedResultCount: translatedResults.data.length,
        combinedResultCount: combinedResults.length,
        uniqueFromTranslation: translatedResults.isTranslated ? 
          combinedResults.filter(r => r.fromTranslatedQuery).length : 0
      });
    }
    
    // Step 3: Summary of all keywords used
    console.log('\n=== Step 3: Summary of all keywords used for Google Scholar searches ===');
    console.log('\nOriginal topic:', userQuery);
    console.log('\nAll search queries used:');
    
    allResults.forEach((result, index) => {
      console.log(`\nQuery ${index + 1}:`);
      console.log(`- Original: "${result.originalQuery}"`);
      
      if (result.translatedQuery && result.translatedQuery !== result.originalQuery) {
        console.log(`- Translated: "${result.translatedQuery}"`);
        console.log(`- Results: ${result.originalResultCount} (original) + ${result.uniqueFromTranslation} unique from translation = ${result.combinedResultCount} total`);
      } else {
        console.log(`- No translation needed (already in English)`);
        console.log(`- Results: ${result.originalResultCount}`);
      }
    });
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testScholarKeywords().catch(console.error);
