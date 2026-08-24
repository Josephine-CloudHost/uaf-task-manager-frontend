/*************************************************************
 * API — talks to the Apps Script backend.
 * Every call is a POST with Content-Type: text/plain (this is
 * required so the browser treats it as a CORS "simple request"
 * and never sends a preflight OPTIONS — Apps Script Web Apps
 * can't answer those). The body is still JSON; the backend
 * parses it as JSON internally.
 *************************************************************/
const Api = (() => {
async function call(action, params = {}) {
  if (!CONFIG.API_URL) {
    throw new Error('This app has not been configured yet — set API_URL in js/config.js.');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s

  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal,
    });
  } catch (networkErr) {
    if (networkErr.name === 'AbortError') {
      throw new Error('The server is taking too long to respond. Please try again.');
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }
 
}
  const inFlight = new Set();

async function call(action, params = {}) {
  const key = action + JSON.stringify(params);
  if (inFlight.has(key)) {
    throw new Error('Request already in progress.');
  }
  inFlight.add(key);
  try {
    // ...existing fetch logic...
  } finally {
    inFlight.delete(key);
  }
}
  // Same call, but throws a readable Error when the backend replies
  // { success:false }. Convenient for actions where a failure should
  // just surface as a caught error (forms, buttons, etc).
  async function callOrThrow(action, params = {}) {
    const data = await call(action, params);
    if (data && data.success === false) {
      throw new Error(data.message || 'Something went wrong.');
    }
    return data;
  }
  return { call, callOrThrow };
})();

