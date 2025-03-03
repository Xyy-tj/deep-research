import axios from 'axios';

// Get SerpAPI key from environment variables
const serpApiKey = process.env.SERPAPI_KEY ?? '';

/**
 * Function to search Google Scholar using SerpAPI
 * This is a simplified version of the function in deep-research.ts
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
    
    // Log the results for debugging
    console.log('Organic Results:', organicResults);
    

    const formattedResults = {
      data: organicResults.map((result: any) => ({
        url: result.link || '',
        title: result.title || '',
        description: `${result.title || ''}\n\n${result.publication_info?.summary || ''}\n\n${result.snippet || ''}\n\nAuthors: ${result.publication_info?.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}\n\nCited by: ${result.inline_links?.cited_by?.total || 0} papers`,
      })),
    };

    return formattedResults;
  } catch (error) {
    console.error('Error searching Google Scholar:', error);
    return { data: [] };
  }
}

/**
 * Test function for SerpAPI Google Scholar integration
 */
async function testSerpApi() {
  try {
    console.log('Testing SerpAPI Google Scholar search...');
    
    // Test queries - one in English and one in Chinese
    const queries = [
      'machine learning applications in healthcare'
    ];
    
    for (const query of queries) {
      console.log(`\nTesting query: "${query}"`);
      
      const result = await searchGoogleScholar(query);
      
      if (!result || !result.data || result.data.length === 0) {
        console.log('\nNo results found. This could indicate:');
        console.log('1. API connection issues');
        console.log('2. Query processing issues');
        console.log('3. No matching results in the database');
        console.log('4. Invalid or missing SerpAPI key');
      } else {
        console.log(`\nFound ${result.data.length} results`);
        result.data.forEach((r: any, i: number) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`Title: ${r.title}`);
          console.log(`URL: ${r.url}`);
          console.log(`Description: ${r.description.substring(0, 200)}...`); // Truncate description for readability
        });
      }
    }
    
    // Test additional parameters
    console.log('\n\nTesting with additional parameters...');
    const advancedQuery = 'artificial intelligence';
    console.log(`Query: "${advancedQuery}" with year range and sort by date`);
    
    try {
      const advancedResponse = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: advancedQuery,
          api_key: serpApiKey,
          as_ylo: '2020', // Articles published since 2020
          as_yhi: '2025', // Articles published before 2025
          sort: 'date', // Sort by date
        },
      });
      
      console.log(`Found ${advancedResponse.data.organic_results?.length || 0} results with date filtering`);
      
      // Display search information
      if (advancedResponse.data.search_metadata) {
        console.log('\nSearch Metadata:');
        console.log(`Status: ${advancedResponse.data.search_metadata.status}`);
        console.log(`ID: ${advancedResponse.data.search_metadata.id}`);
        console.log(`Created At: ${advancedResponse.data.search_metadata.created_at}`);
        console.log(`Processed At: ${advancedResponse.data.search_metadata.processed_at}`);
        console.log(`Total Time Taken: ${advancedResponse.data.search_metadata.total_time_taken}`);
      }
      
    } catch (error) {
      console.error('Error with advanced search:', error);
    }
    
  } catch (error) {
    console.error('Error testing SerpAPI:', error);
  }
}

// Run the test
testSerpApi().catch(console.error);
