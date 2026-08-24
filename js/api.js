/*************************************************************
 * API — talks to the Apps Script backend.
 * Every call is a POST with Content-Type: text/plain (this is
 * required so the browser treats it as a CORS "simple request"
 * and never sends a preflight OPTIONS — Apps Script Web Apps
 * can't answer those). The body is still JSON; the backend
 * parses it as JSON internally.
 *
 * Adds: a client-side timeout (so a slow backend fails fast with
 * a clear message instead of hanging until the network gives up),
 * and a duplicate-request guard (so an impatient double-click
 * doesn't fire the same slow request twice).
 *************************************************************/
const Api = (() => {
  const REQUEST_TIMEOUT_MS = 25000;
  const inFlight = new Set();

  async function call(action, params = {}) {
    if (!CONFIG.API_URL) {
      throw new Error('This app has not been configured yet — set API_URL in js/config.js.');
    }

    const key = action + JSON.stringify(params);
    if (inFlight.has(key)) {
      throw new Error('That request is already in progress — please wait.');
    }
    inFlight.add(key);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      inFlight.delete(key);
    }

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error('Unexpected response from the server.');
    }
    return data;
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
