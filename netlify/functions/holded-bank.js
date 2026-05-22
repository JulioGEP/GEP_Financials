// Netlify Function: proxy for Holded Bank Accounts API
// Uses API_HOLDED_KEY env var (set in Netlify dashboard).
// Endpoint: GET /api/invoicing/v1/treasury → { accounts: [{id, name, balance, currency}] }

const HOLDED_API_URL = 'https://api.holded.com/api/invoicing/v1/treasury';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const apiKey = process.env.API_HOLDED_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'API_HOLDED_KEY not configured', timestamp: new Date().toISOString() }),
    };
  }

  try {
    const response = await fetch(HOLDED_API_URL, {
      headers: {
        key: apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Holded API returned ${response.status}`,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const body = await response.json();
    // /api/invoicing/v1/treasury returns { accounts: [{id, name, balance, currency}] }
    const raw = Array.isArray(body) ? body : (body.accounts ?? []);
    const accounts = raw.map((a) => ({
      id: a.id ?? a._id ?? String(Math.random()),
      name: a.name ?? a.desc ?? 'Cuenta',
      desc: a.desc,
      balance: a.balance ?? 0,
      currency: a.currency ?? 'EUR',
      number: a.number,
      active: a.active,
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ data: accounts, timestamp: new Date().toISOString() }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error && error.message ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
