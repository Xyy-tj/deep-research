import FirecrawlApp from '@mendable/firecrawl-js';
import axios from 'axios';
import pLimit from 'p-limit';

// Initialize Firecrawl with API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// Get SerpAPI key from environment variables
const serpApiKey = process.env.SERPAPI_KEY ?? '';

// Get concurrency limit from environment variable, default to 2 if not set
const ConcurrencyLimit = Number(process.env.CONCURRENCY_LIMIT ?? 2);

/**
 * Function to search Google Scholar using SerpAPI
 */
async function searchGoogleScholar(query: string): Promise<any> {
  if (!serpApiKey) {
    console.log('SerpAPI key not found. Please set SERPAPI_KEY in your .env.local file.');
    return { data: [] };
  }

  try {
    console.log(`Searching Google Scholar for: ${query}`);
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: query,
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
      })),
    };

    console.log(`Google Scholar search found ${formattedResults.data.length} results`);
    return formattedResults;
  } catch (error) {
    console.error('Error searching Google Scholar:', error);
    return { data: [] };
  }
}

/**
 * Test function for combined Firecrawl and SerpAPI search
 * This simulates the behavior in the deepResearch function
 */
async function testCombinedSearch() {
  try {
    console.log('Testing combined Firecrawl and SerpAPI Google Scholar search...');
    
    // Test queries
    const queries = [
      'machine learning applications in healthcare',
      '中国镁矿产量研究'
    ];
    
    // Create concurrency limit
    const limit = pLimit(ConcurrencyLimit);
    
    for (const query of queries) {
      console.log(`\n\n========== Testing query: "${query}" ==========`);
      
      try {
        // Perform web search using Firecrawl
        console.log('\nPerforming web search with Firecrawl...');
        const webResult = await limit(() => firecrawl.search(query, {
          scrapeOptions: {
            formats: ["markdown"]
          }
        }));
        
        console.log(`Firecrawl found ${webResult.data.length} results`);
        
        // Perform Google Scholar search
        console.log('\nPerforming academic search with Google Scholar...');
        const scholarResult = await limit(() => searchGoogleScholar(query));
        
        // Combine results from both sources
        const combinedResult = {
          data: [...webResult.data, ...scholarResult.data]
        };
        
        console.log(`\nCombined results: ${combinedResult.data.length} total (${webResult.data.length} web + ${scholarResult.data.length} academic)`);
        
        // Display summary of results
        console.log('\nSummary of combined results:');
        combinedResult.data.forEach((r: any, i: number) => {
          const source = webResult.data.includes(r) ? 'Web' : 'Academic';
          console.log(`\nResult ${i + 1} (${source}):`);
          console.log(`Title: ${r.title}`);
          console.log(`URL: ${r.url}`);
        });
        
        // Analyze source distribution
        const webUrls = new Set(webResult.data.map((r: any) => r.url));
        const academicUrls = new Set(scholarResult.data.map((r: any) => r.url));
        
        // Check for any overlap between sources
        const overlap = [...webUrls].filter(url => academicUrls.has(url));
        
        console.log('\nSource Analysis:');
        console.log(`Web-only sources: ${webUrls.size - overlap.length}`);
        console.log(`Academic-only sources: ${academicUrls.size - overlap.length}`);
        console.log(`Overlapping sources: ${overlap.length}`);
        
        if (overlap.length > 0) {
          console.log('\nOverlapping URLs:');
          overlap.forEach(url => console.log(`- ${url}`));
        }
        
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }
  } catch (error) {
    console.error('Error in combined search test:', error);
  }
}

// Run the test
testCombinedSearch().catch(console.error);
