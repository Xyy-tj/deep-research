import axios from 'axios';

// Get SerpAPI key from environment variables
const serpApiKey = process.env.SERPAPI_KEY ?? '';

/**
 * Test function for advanced SerpAPI Google Scholar features
 * This explores various parameters and options available in the Google Scholar API
 */
async function testSerpApiAdvanced() {
  if (!serpApiKey) {
    console.log('SerpAPI key not found. Please set SERPAPI_KEY in your .env.local file.');
    return;
  }

  try {
    console.log('Testing Advanced SerpAPI Google Scholar Features');
    
    // Test 1: Filter by publication date
    await testDateFiltering();
    
    // Test 2: Filter by author
    await testAuthorFiltering();
    
    // Test 3: Search for specific publication
    await testPublicationSearch();
    
    // Test 4: Pagination
    await testPagination();
    
    // Test 5: Citation search
    await testCitationSearch();
    
  } catch (error) {
    console.error('Error in advanced SerpAPI tests:', error);
  }
}

/**
 * Test filtering results by publication date
 */
async function testDateFiltering() {
  console.log('\n\n========== Test: Filtering by Publication Date ==========');
  
  try {
    const query = 'artificial intelligence';
    console.log(`Query: "${query}" with date range 2020-2023`);
    
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: query,
        api_key: serpApiKey,
        as_ylo: '2020', // Articles published since 2020
        as_yhi: '2023', // Articles published before 2023
      },
    });
    
    const results = response.data.organic_results || [];
    console.log(`Found ${results.length} results published between 2020-2023`);
    
    if (results.length > 0) {
      console.log('\nSample results:');
      results.slice(0, 3).forEach((result: any, index: number) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Title: ${result.title}`);
        console.log(`Publication info: ${result.publication_info?.summary || 'N/A'}`);
        console.log(`Year: ${extractYear(result.publication_info?.summary) || 'Unknown'}`);
      });
    }
  } catch (error) {
    console.error('Error in date filtering test:', error);
  }
}

/**
 * Test filtering results by author
 */
async function testAuthorFiltering() {
  console.log('\n\n========== Test: Filtering by Author ==========');
  
  try {
    // Search for papers by a specific author
    const author = 'Andrew Ng';
    console.log(`Searching for papers by author: "${author}"`);
    
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: `author:"${author}"`,
        api_key: serpApiKey,
      },
    });
    
    const results = response.data.organic_results || [];
    console.log(`Found ${results.length} results by author ${author}`);
    
    if (results.length > 0) {
      console.log('\nSample results:');
      results.slice(0, 3).forEach((result: any, index: number) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Title: ${result.title}`);
        console.log(`Authors: ${extractAuthors(result) || 'Unknown'}`);
        console.log(`Publication info: ${result.publication_info?.summary || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('Error in author filtering test:', error);
  }
}

/**
 * Test searching for a specific publication
 */
async function testPublicationSearch() {
  console.log('\n\n========== Test: Searching for Specific Publication ==========');
  
  try {
    // Search for papers in a specific journal or conference
    const publication = 'Nature';
    const query = 'quantum computing';
    console.log(`Searching for "${query}" in publication: "${publication}"`);
    
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: `${query} source:"${publication}"`,
        api_key: serpApiKey,
      },
    });
    
    const results = response.data.organic_results || [];
    console.log(`Found ${results.length} results about ${query} in ${publication}`);
    
    if (results.length > 0) {
      console.log('\nSample results:');
      results.slice(0, 3).forEach((result: any, index: number) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Title: ${result.title}`);
        console.log(`Publication info: ${result.publication_info?.summary || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('Error in publication search test:', error);
  }
}

/**
 * Test pagination of results
 */
async function testPagination() {
  console.log('\n\n========== Test: Pagination ==========');
  
  try {
    const query = 'machine learning';
    console.log(`Testing pagination for query: "${query}"`);
    
    // First page (default is 10 results per page)
    const firstPageResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: query,
        api_key: serpApiKey,
        start: 0, // First page
      },
    });
    
    const firstPageResults = firstPageResponse.data.organic_results || [];
    console.log(`First page: Found ${firstPageResults.length} results`);
    
    // Second page
    const secondPageResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: query,
        api_key: serpApiKey,
        start: 10, // Second page (starts at index 10)
      },
    });
    
    const secondPageResults = secondPageResponse.data.organic_results || [];
    console.log(`Second page: Found ${secondPageResults.length} results`);
    
    // Check if results are different between pages
    const firstPageTitles = new Set(firstPageResults.map((r: any) => r.title));
    const secondPageTitles = new Set(secondPageResults.map((r: any) => r.title));
    
    let overlap = 0;
    secondPageResults.forEach((result: any) => {
      if (firstPageTitles.has(result.title)) {
        overlap++;
      }
    });
    
    console.log(`Overlap between pages: ${overlap} results`);
    console.log(`Unique results across both pages: ${firstPageTitles.size + secondPageTitles.size - overlap}`);
  } catch (error) {
    console.error('Error in pagination test:', error);
  }
}

/**
 * Test citation search
 */
async function testCitationSearch() {
  console.log('\n\n========== Test: Citation Search ==========');
  
  try {
    // First find a highly cited paper
    const initialQuery = 'deep learning';
    console.log(`Finding a highly cited paper about: "${initialQuery}"`);
    
    const initialResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_scholar',
        q: initialQuery,
        api_key: serpApiKey,
      },
    });
    
    const initialResults = initialResponse.data.organic_results || [];
    
    if (initialResults.length === 0) {
      console.log('No initial results found');
      return;
    }
    
    // Find the result with the most citations
    let mostCitedPaper = initialResults[0];
    let maxCitations = 0;
    
    initialResults.forEach((result: any) => {
      const citations = result.inline_links?.cited_by?.total || 0;
      if (citations > maxCitations) {
        maxCitations = citations;
        mostCitedPaper = result;
      }
    });
    
    console.log(`\nMost cited paper found:`);
    console.log(`Title: ${mostCitedPaper.title}`);
    console.log(`Citations: ${maxCitations}`);
    
    // If we have a citation link, get papers that cite this one
    if (mostCitedPaper.inline_links?.cited_by?.serpapi_scholar_link) {
      console.log('\nFetching papers that cite this paper...');
      
      // Extract the citation query from the link
      const citationLink = mostCitedPaper.inline_links.cited_by.serpapi_scholar_link;
      const citationQueryMatch = citationLink.match(/q=([^&]+)/);
      
      if (citationQueryMatch && citationQueryMatch[1]) {
        const citationQuery = decodeURIComponent(citationQueryMatch[1]);
        
        const citationResponse = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google_scholar',
            q: citationQuery,
            api_key: serpApiKey,
          },
        });
        
        const citingPapers = citationResponse.data.organic_results || [];
        console.log(`Found ${citingPapers.length} papers citing the selected paper`);
        
        if (citingPapers.length > 0) {
          console.log('\nSample citing papers:');
          citingPapers.slice(0, 3).forEach((result: any, index: number) => {
            console.log(`\nCiting paper ${index + 1}:`);
            console.log(`Title: ${result.title}`);
            console.log(`Publication info: ${result.publication_info?.summary || 'N/A'}`);
          });
        }
      } else {
        console.log('Could not extract citation query from link');
      }
    } else {
      console.log('No citation link available for this paper');
    }
  } catch (error) {
    console.error('Error in citation search test:', error);
  }
}

/**
 * Helper function to extract year from publication info
 */
function extractYear(publicationInfo: string | undefined): string | null {
  if (!publicationInfo) return null;
  
  // Look for a 4-digit year
  const yearMatch = publicationInfo.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : null;
}

/**
 * Helper function to extract authors from a result
 */
function extractAuthors(result: any): string | null {
  if (result.publication_info?.authors) {
    return result.publication_info.authors.map((a: any) => a.name).join(', ');
  }
  return null;
}

// Run the test
testSerpApiAdvanced().catch(console.error);
