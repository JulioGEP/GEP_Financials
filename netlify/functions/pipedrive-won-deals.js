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
 * Sums numeric values from an object whose keys are currency codes
 * (e.g. { EUR: 1234.56, USD: 200 }). Returns 0 if not a usable object.
 */
function sumCurrencyObject(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  let total = 0;
  for (const key of Object.keys(obj)) {
    const n = Number(obj[key]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Extracts a numeric value (in EUR if possible) from a Pipedrive
 * deals/timeline interval. The API response structure differs by
 * account config and version; this tries every known path.
 *
 * Known structures observed:
 *   - totals_converted.values_total        : number (after currency convert)
 *   - totals_converted.values_total.EUR    : number (older API)
 *   - totals.values                        : { EUR: n, USD: n, ... }
 *   - totals.values_total                  : number
 *   - totals.weighted_values               : { EUR: n, ... }
 *   - totals.weighted_values_total         : number
 */
function extractValue(interval) {
  const tc = interval.totals_converted;
  if (tc) {
    // totals_converted.values_total as plain number
    if (typeof tc.values_total === 'number' && tc.values_total > 0) {
      return tc.values_total;
    }
    // totals_converted.values_total as object keyed by currency
    if (tc.values_total && typeof tc.values_total === 'object') {
      const vt = tc.values_total;
      if (vt.EUR != null && Number(vt.EUR) > 0) return Number(vt.EUR);
      for (const k of Object.keys(vt)) {
        if (vt[k] != null && Number(vt[k]) > 0) return Number(vt[k]);
      }
    }
    // weighted as fallback under totals_converted
    if (typeof tc.weighted_values_total === 'number' && tc.weighted_values_total > 0) {
      return tc.weighted_values_total;
    }
  }

  const t = interval.totals;
  if (t) {
    // totals.values_total as number
    if (typeof t.values_total === 'number' && t.values_total > 0) {
      return t.values_total;
    }
    // totals.values is an object keyed by currency — the most common shape
    if (t.values && typeof t.values === 'object') {
      if (t.values.EUR != null && Number(t.values.EUR) > 0) return Number(t.values.EUR);
      // No EUR (or EUR is 0): sum every currency we got (best-effort,
      // assumes amounts are comparable — better than reporting 0)
      const sum = sumCurrencyObject(t.values);
      if (sum > 0) return sum;
    }
    if (typeof t.weighted_values_total === 'number' && t.weighted_values_total > 0) {
      return t.weighted_values_total;
    }
    if (t.weighted_values && typeof t.weighted_values === 'object') {
      if (t.weighted_values.EUR != null && Number(t.weighted_values.EUR) > 0) {
        return Number(t.weighted_values.EUR);
      }
      const sum = sumCurrencyObject(t.weighted_values);
      if (sum > 0) return sum;
    }
  }

  // Last-resort: sum deal values from the deals array if present
  if (Array.isArray(interval.deals) && interval.deals.length > 0) {
    let sum = 0;
    for (const d of interval.deals) {
      const v = Number(d.value ?? d.formatted_value ?? 0);
      if (Number.isFinite(v) && v > 0) sum += v;
    }
    if (sum > 0) return sum;
  }

  return 0;
}

async function fetchTimeline(year, token, fieldKey, options = {}) {
  const params = new URLSearchParams({
    start_date: `${year}-01-01`,
    interval: 'month',
    amount: '12',
    field_key: fieldKey,
    exclude_deals: options.excludeDeals ? '1' : '0',
    api_token: token,
  });
  if (options.convertEUR) {
    params.set('totals_convert_currency', 'EUR');
  }

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

function mapIntervals(intervals) {
  return intervals.map((interval) => ({
    period: interval.period_start,
    value: extractValue(interval),
    count: interval.totals?.count ?? 0,
  }));
}

async function getWonDealsByMonth(year, token) {
  // First attempt: won_time + EUR conversion, deals excluded for payload size.
  let intervals = await fetchTimeline(year, token, 'won_time', {
    excludeDeals: true,
    convertEUR: true,
  });

  console.log(`[pipedrive] year=${year} field=won_time intervals=${intervals.length}`);
  if (intervals.length > 0) {
    const sample = intervals[0];
    console.log(`[pipedrive] sample keys: ${Object.keys(sample).join(', ')}`);
    console.log(`[pipedrive] sample totals: ${JSON.stringify(sample.totals)}`);
    console.log(`[pipedrive] sample totals_converted: ${JSON.stringify(sample.totals_converted)}`);
  }

  let mapped = mapIntervals(intervals);
  let totalValue = mapped.reduce((s, m) => s + m.value, 0);
  const totalCount = mapped.reduce((s, m) => s + m.count, 0);

  // If the count says we have deals but the total is 0, currency conversion
  // is likely the problem (no EUR rate configured). Re-fetch including deals
  // so extractValue can sum native deal values as a fallback.
  if (totalValue === 0 && totalCount > 0) {
    console.log(`[pipedrive] year=${year} retry: count=${totalCount} but value=0, refetching with deals`);
    intervals = await fetchTimeline(year, token, 'won_time', {
      excludeDeals: false,
      convertEUR: false,
    });
    mapped = mapIntervals(intervals);
    totalValue = mapped.reduce((s, m) => s + m.value, 0);
  }

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
