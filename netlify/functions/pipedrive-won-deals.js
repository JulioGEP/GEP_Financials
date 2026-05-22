// Netlify Function: proxy for Pipedrive "deals timeline" API
// Uses PIPEDRIVE_API_TOKEN env var (set in Netlify dashboard).
// Returns total value of won deals grouped by month for a given year.

const BASE_URL = 'https://api.pipedrive.com/v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

async function getWonDealsByMonth(year, token) {
  const params = new URLSearchParams({
    start_date: `${year}-01-01`,
    interval: 'month',
    amount: '12',
    field_key: 'won_time',
    exclude_deals: '1',
    totals_convert_currency: 'EUR',
    api_token: token,
  });

  const response = await fetch(`${BASE_URL}/deals/timeline?${params}`);
  if (!response.ok) {
    throw new Error(`Pipedrive API error: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error('Pipedrive returned success: false');
  }

  return (json.data || []).map((interval) => ({
    period: interval.period_start,
    value:
      interval.totals_converted?.values_total?.EUR ??
      interval.totals?.values_total ??
      0,
    count: interval.totals?.count ?? 0,
  }));
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) {
    return {
      statusCode: 503,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'PIPEDRIVE_API_TOKEN not configured',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  try {
    const qs = event.queryStringParameters || {};
    const currentYear = new Date().getFullYear();
    const year = Number(qs.year) || currentYear;
    const prior = Number(qs.prior) || year - 1;

    const [currentData, priorData] = await Promise.all([
      getWonDealsByMonth(year, token),
      getWonDealsByMonth(prior, token),
    ]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        year,
        prior,
        current: currentData,
        priorYear: priorData,
        timestamp: new Date().toISOString(),
      }),
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
