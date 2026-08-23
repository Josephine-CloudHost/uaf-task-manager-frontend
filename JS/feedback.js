'use strict';

function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(v) {
  if (!v) return '\u2014';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '\u2014' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function init() {
  const root = document.getElementById('feedback-root');
  const taskId = getParam('taskId');
  const ftoken = getParam('ftoken');

  if (!taskId || !ftoken) {
    root.innerHTML = errorBlock('Link incomplete', 'This feedback link is missing information. Please use the link from your reminder email.');
    return;
  }

  let task;
  try {
    task = await Api.callOrThrow('getTaskForFeedback', { taskId, ftoken });
  } catch (err) {
    root.innerHTML = errorBlock('Could not load this task', err.message);
    return;
  }
  if (!task) {
    root.innerHTML = errorBlock('Link expired or invalid', 'This feedback link no longer works. Reach out to the program team if you still need to report progress.');
    return;
  }

  renderForm(task, taskId, ftoken);
}

function errorBlock(title, sub) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(sub)}</div>`;
}

function renderForm(task, taskId, ftoken) {
  const root = document.getElementById('feedback-root');
  root.innerHTML = `
    <div class="login-mark" style="margin-bottom:18px;">
      <div class="glyph">FL</div>
      <h1 style="font-size:18px;">Task update</h1>
    </div>
    <div class="feedback-meta">
      <div><span class="label">Task</span></div>
      <div><strong>${escapeHtml(task.Title)}</strong></div>
      <div style="display:flex; gap:16px; margin-top:8px; flex-wrap:wrap;">
        <div><span class="label">Project</span><div>${escapeHtml(task.Project)}</div></div>
        <div><span class="label">Deadline</span><div>${fmtDate(task.Deadline)}</div></div>
        <div><span class="label">Current status</span><div>${escapeHtml(task.Status)}</div></div>
      </div>
    </div>
    <div id="fb-error" class="form-error hidden"></div>
    <div id="fb-success" class="form-note hidden"></div>
    <form id="fb-form">
      <div class="field">
        <label for="fb-status">Report your status</label>
        <select id="fb-status" name="statusUpdate">
          <option value="">Don\u2019t change status</option>
          <option value="In Progress">In progress</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Still pending</option>
        </select>
      </div>
      <div class="field">
        <label for="fb-message">Message to the program team</label>
        <textarea id="fb-message" name="message" required placeholder="Tell us how things are going\u2026"></textarea>
      </div>
      <button type="submit" class="btn btn-full" id="fb-submit">Send update</button>
    </form>`;

  document.getElementById('fb-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('fb-error');
    const okEl = document.getElementById('fb-success');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');
    const btn = document.getElementById('fb-submit');
    btn.disabled = true;
    btn.textContent = 'Sending\u2026';
    try {
      const message = document.getElementById('fb-message').value.trim();
      const statusUpdate = document.getElementById('fb-status').value;
      const res = await Api.call('submitTaskFeedback', { taskId, ftoken, message, statusUpdate: statusUpdate || undefined });
      if (!res.success) throw new Error(res.message || 'Could not send your update.');
      okEl.textContent = 'Thank you \u2014 your update has been sent to the program team.';
      okEl.classList.remove('hidden');
      document.getElementById('fb-form').reset();
      document.getElementById('fb-form').querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send update';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
