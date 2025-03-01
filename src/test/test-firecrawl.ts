import FirecrawlApp from '@mendable/firecrawl-js';

// Initialize Firecrawl with API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

async function testFirecrawl() {
  try {
    console.log('Testing Firecrawl search...');
    
    // Test query
    const query = '全球与中国近10年镁矿产量对比及趋势研究';
    console.log(`Testing query: "${query}"`);
    
    const result = await firecrawl.search(query, {
      scrapeOptions: {
        formats: ["markdown"]
      }
    });
    
    console.log('\nSearch Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (!result || !result.data || result.data.length === 0) {
      console.log('\nNo results found. This could indicate:');
      console.log('1. API connection issues');
      console.log('2. Query processing issues');
      console.log('3. No matching results in the database');
    } else {
      console.log(`\nFound ${result.data.length} results`);
      result.data.forEach((r, i) => {
        console.log(`\nResult ${i + 1}:`);
        console.log(`Title: ${r.title}`);
        console.log(`URL: ${r.url}`);
        console.log(`Description: ${r.description}`);
        console.log(`Markdown: ${r.markdown}`);
      });
    }
  } catch (error) {
    console.error('Error testing Firecrawl:', error);
  }
}

testFirecrawl().catch(console.error);
