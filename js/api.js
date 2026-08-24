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
    if (!CONFIG.API_URL || CONFIG.API_URL.indexOf(YOUR_URL) === 0) {
      throw new Error('This app has not been configured yet — set API_URL in js/config.js.');
    }
    let res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...params }),
      });
    } catch (networkErr) {
      throw new Error('Could not reach the server. Check your connection and try again.');
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
