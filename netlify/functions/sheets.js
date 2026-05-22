// Netlify Function: server-side proxy for Google Sheets CSV
// Avoids CORS issues by fetching from Google Sheets server-side.

const SHEET_ID =
  process.env.SHEET_ID || '1z04Eh_zt0GoDJhqPiGiWKdz66z_Y94yemUGfiKwUBwY';
const OBJETIVOS_SHEET_ID =
  process.env.OBJETIVOS_SHEET_ID || '1iknWcgkkIhJ7NvowHg61QqRnu6p-uQJB8B7kp-SJ9aU';
const VENTAS_GID = process.env.VENTAS_GID || '0';
const GASTOS_GID = process.env.GASTOS_GID || '1465840856';
const OBJETIVOS_GID = process.env.OBJETIVOS_GID || '497424162';

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

  const sheet = (event.queryStringParameters && event.queryStringParameters.sheet) || 'ventas';
  const gid = sheet === 'gastos'
    ? GASTOS_GID
    : sheet === 'objetivos'
    ? OBJETIVOS_GID
    : VENTAS_GID;
  const sheetId = sheet === 'objetivos' ? OBJETIVOS_SHEET_ID : SHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'GEP-Financials/1.0' },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Upstream returned ${response.status}`,
          sheet,
          sheetId,
          gid,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const csv = await response.text();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        data: csv,
        sheet,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error && error.message ? error.message : 'Unknown error',
        sheet,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
