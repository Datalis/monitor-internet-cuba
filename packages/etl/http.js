import { request } from 'undici';

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

export async function fetchJson(url, options = {}) {
  const headers = { 'Accept': 'application/json', ...options.headers };
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await request(url, {
        method: options.method || 'GET',
        headers,
        body: options.body || undefined,
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      if (res.statusCode === 429) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`Rate limited on ${url}, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      if (res.statusCode >= 400) {
        throw new Error(`HTTP ${res.statusCode} from ${url}`);
      }

      return await res.body.json();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed for ${url}: ${err.message}. Retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
