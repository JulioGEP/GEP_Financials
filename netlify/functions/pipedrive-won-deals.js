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

/**
 * Extracts a numeric value from a Pipedrive interval object.
 * Tries every known path in the response to handle different
 * account configurations and API versions.
 */
function extractValue(interval) {
  // Path 1: totals_converted.values_total.EUR  (object with currency keys)
  const tc = interval.totals_converted;
  if (tc && tc.values_total != null) {
    const vt = tc.values_total;
    if (typeof vt === 'number' && vt > 0) return vt;
    if (typeof vt === 'object' && vt !== null) {
      // Try EUR first, then any other currency
      if (vt.EUR != null && vt.EUR > 0) return Number(vt.EUR);
      const keys = Object.keys(vt);
      for (const k of keys) {
        if (vt[k] != null && Number(vt[k]) > 0) return Number(vt[k]);
      }
      // Return EUR even if 0 (legitimate zero month)
      if (vt.EUR != null) return Number(vt.EUR);
      if (keys.length > 0 && vt[keys[0]] != null) return Number(vt[keys[0]]);
    }
  }

  // Path 2: totals.values_total  (non-converted, plain number)
  const t = interval.totals;
  if (t) {
    if (t.values_total != null && Number(t.values_total) >= 0) {
      return Number(t.values_total);
    }
    if (t.weighted_values_total != null) {
      return Number(t.weighted_values_total);
    }
  }

  return 0;
}

async function fetchTimeline(year, token, fieldKey) {
  const params = new URLSearchParams({
    start_date: `${year}-01-01`,
    interval: 'month',
    amount: '12',
    field_key: fieldKey,
    exclude_deals: '1',
    totals_convert_currency: 'EUR',
    api_token: token,
  });

  const response = await fetch(`${BASE_URL}/deals/timeline?${params}`);
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Pipedrive API ${response.status}: ${errText.slice(0, 300)}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(`Pipedrive success=false. ${JSON.stringify(json.error ?? '')}`);
  }
  return json.data || [];
}

async function getWonDealsByMonth(year, token) {
  // Try won_time first (correct field for won deals).
  // Log raw intervals to Netlify function logs for debugging.
  const intervals = await fetchTimeline(year, token, 'won_time');

  console.log(`[pipedrive] year=${year} intervals=${intervals.length}`);
  if (intervals.length > 0) {
    // Log first interval structure (no token) to aid debugging
    const sample = intervals[0];
    console.log(`[pipedrive] sample interval keys: ${Object.keys(sample).join(', ')}`);
    console.log(`[pipedrive] sample totals: ${JSON.stringify(sample.totals)}`);
    console.log(`[pipedrive] sample totals_converted: ${JSON.stringify(sample.totals_converted)}`);
  }

  const mapped = intervals.map((interval) => ({
    period: interval.period_start,
    value: extractValue(interval),
    count: interval.totals?.count ?? 0,
  }));

  const totalValue = mapped.reduce((s, m) => s + m.value, 0);
  console.log(`[pipedrive] year=${year} total won value=${totalValue}`);

  return mapped;
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
    const msg = error && error.message ? error.message : 'Unknown error';
    console.error('[pipedrive] handler error:', msg);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: msg, timestamp: new Date().toISOString() }),
    };
  }
};
