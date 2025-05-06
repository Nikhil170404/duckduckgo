const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio'); // For parsing HTML
const app = express();
const PORT = 5000;

// Middleware to handle CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to ensure URLs are absolute
const ensureAbsoluteUrl = (url) => {
  try {
    // If the URL already starts with http or https, return it as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Otherwise, prepend 'https://' to make it absolute
    return `https://${url}`;
  } catch (error) {
    console.error('Error formatting URL:', error);
    return null;
  }
};

// Proxy endpoint for search
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatApp/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch search results');
    }

    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);

    // Extract up to 10 search results
    const results = [];
    $('.result__body').slice(0, 10).each((index, element) => {
      const titleElement = $(element).find('.result__title .result__a');
      const snippetElement = $(element).find('.result__snippet');
      const linkElement = $(element).find('.result__url');

      const title = titleElement.text().trim() || 'No title available';
      const snippet = snippetElement.text().trim() || 'No snippet available';
      const link = linkElement.text().trim() || 'No link available';

      if (title !== 'No title available' && snippet !== 'No snippet available' && link !== 'No link available') {
        results.push({ title, snippet, link: ensureAbsoluteUrl(link) });
      }
    });

    res.json(results);
  } catch (error) {
    console.error('Error fetching search results:', error.message || error);
    res.status(500).json({ error: 'Error fetching search results', details: error.message || 'Unknown error' });
  }
});

// Endpoint to fetch and parse full article content
app.get('/article', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Ensure the URL is absolute
    const absoluteUrl = ensureAbsoluteUrl(url);
    if (!absoluteUrl) {
      throw new Error('Invalid URL');
    }

    const response = await fetch(absoluteUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatApp/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article from ${absoluteUrl}`);
    }

    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);

    // Extract main article content (adjust selectors based on website structure)
    let content = '';
    $('p, h1, h2, h3, h4, h5, h6').each((index, element) => {
      const text = $(element).text().trim();
      if (text) {
        content += text + '\n';
      }
    });

    res.json({ content });
  } catch (error) {
    console.error('Error fetching article content:', error.message || error);
    res.status(500).json({ error: 'Error fetching article content', details: error.message || 'Unknown error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
