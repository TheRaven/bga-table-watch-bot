import { BGA_ORIGIN, BGA_TABLE_URL, BGA_TABLE_INFO_URL } from './config.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function extractTableId(url) {
  const short = url.match(/bga\.li\/t\/(\d+)/);
  if (short) return short[1];
  const full = url.match(/table=(\d+)/);
  return full ? full[1] : null;
}

export async function fetchTableInfo(tableId) {
  const tableUrl = `${BGA_TABLE_URL}?table=${tableId}`;
  const infoUrl = BGA_TABLE_INFO_URL;

  // Step 1: fetch the table page to get PHPSESSID cookie and request token
  const pageResponse = await fetch(tableUrl, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });

  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch BGA page: ${pageResponse.status}`);
  }

  const setCookies = pageResponse.headers.getSetCookie?.() || [];
  const phpSessId = setCookies.find(c => c.includes('PHPSESSID'));
  const cookieString = phpSessId ? phpSessId.split(';')[0] : '';

  const html = await pageResponse.text();

  const tokenMatch = html.match(/requestToken\s*[:=]\s*["']([^"']+)["']/);
  if (!tokenMatch) {
    throw new Error('Could not find requestToken in page source');
  }
  const requestToken = tokenMatch[1];

  // Step 2: POST to table info endpoint
  const infoResponse = await fetch(infoUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': cookieString,
      'X-Request-Token': requestToken,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': BGA_ORIGIN,
      'Referer': tableUrl,
    },
    body: `id=${tableId}`,
  });

  if (!infoResponse.ok) {
    throw new Error(`Failed to fetch table info: ${infoResponse.status}`);
  }

  return infoResponse.json();
}

export function getSeatsInfo(tableData) {
  const data = tableData.data;

  if (!data) {
    console.error('Unexpected BGA response:', JSON.stringify(tableData).slice(0, 500));
    throw new Error('BGA response missing data field');
  }

  const maxPlayers = parseInt(data.max_player || 0, 10);
  const currentPlayers = parseInt(data.current_player_nbr || 0, 10);
  const status = data.status || 'unknown';
  const seatsLeft = Math.max(0, maxPlayers - currentPlayers);
  const hasStarted = status !== 'init' && status !== 'asyncinit';
  const isFull = seatsLeft === 0 || hasStarted;

  return { maxPlayers, currentPlayers, seatsLeft, isFull, hasStarted };
}
