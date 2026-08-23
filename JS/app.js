/*************************************************************
 * APP — routing, auth, and every tab's view + actions.
 *************************************************************/
'use strict';

const State = {
  token: null,
  role: null,
  fullName: null,
  username: null,
  config: { projectOptions: [], categoryOptions: [], typeOptions: [], roleOptions: [], docTypeOptions: [] },
  activeTab: null,
  contactsCache: null, // small perf win: several tabs need the contact list
};

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Reassigned'];

/* ===================== NAV CONFIG ===================== */
const NAV_BY_ROLE = {
  Admin: [
    { key: 'contacts', label: 'Contacts', icon: '◆' },
    { key: 'tasks', label: 'Tasks', icon: '◆' },
    { key: 'team', label: 'Team logins', icon: '◆' },
    { key: 'updates', label: 'Announcements', icon: '◆' },
    { key: 'documents', label: 'Documents', icon: '◆' },
    { key: 'reassign', label: 'Reassignment requests', icon: '◆' },
    { key: 'comments', label: 'All comments', icon: '◆' },
    { key: 'reports', label: 'Reports (PDF)', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
  Coordinator: [
    { key: 'contacts', label: 'Contacts', icon: '◆' },
    { key: 'tasks', label: 'Tasks', icon: '◆' },
    { key: 'updates', label: 'Announcements', icon: '◆' },
    { key: 'documents', label: 'Documents', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
  Implementer: [
    { key: 'mytasks', label: 'My tasks', icon: '◆' },
    { key: 'mydocuments', label: 'Reports', icon: '◆' },
    { key: 'myupdates', label: 'Announcements', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
  Partners: [
    { key: 'mydocuments', label: 'Reports', icon: '◆' },
    { key: 'myupdates', label: 'Announcements', icon: '◆' },
    { key: 'mycomments', label: 'Comments', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
  Donor: [
    { key: 'mydocuments', label: 'Reports', icon: '◆' },
    { key: 'myupdates', label: 'Announcements', icon: '◆' },
    { key: 'mycomments', label: 'Comments', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
  Supporter: [
    { key: 'mydocuments', label: 'Reports', icon: '◆' },
    { key: 'myupdates', label: 'Announcements', icon: '◆' },
    { key: 'mycomments', label: 'Comments', icon: '◆' },
    { key: 'account', label: 'Account', icon: '◆' },
  ],
};

const TAB_TITLES = {
  contacts: ['Contacts', 'Everyone the program works with, across all projects.'],
  tasks: ['Tasks', 'Assignments tracked from kickoff to close-out.'],
  team: ['Team logins', 'Who can sign in, and what they can see.'],
  updates: ['Announcements', 'Send project updates and announcements to contacts.'],
  documents: ['Documents', 'Meeting minutes, reports, and files shared with contacts.'],
  reassign: ['Reassignment requests', 'Deadline and ownership changes requested by implementers.'],
  comments: ['All comments', 'Every comment left across documents, for oversight.'],
  reports: ['Reports', 'Export data to PDF.'],
  account: ['Account', 'Your login details.'],
  mytasks: ['My tasks', 'Tasks assigned to you.'],
  mydocuments: ['Reports', 'Documents shared with your organization.'],
  myupdates: ['Announcements', 'Project updates sent to you.'],
  mycomments: ['Comments', 'Leave feedback and see what you\u2019ve said before.'],
};

/* ===================== UTILITIES ===================== */
function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(v) {
  if (!v) return '\u2014';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(v) {
  if (!v) return '\u2014';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toDateInputValue(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toast(message, type = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function projectStampClass(project) {
  const p = (project || '').toLowerCase();
  if (p.indexOf('nic') !== -1) return 'stamp-nic';
  if (p.indexOf('whei') !== -1) return 'stamp-whei';
  if (p.indexOf('lap') !== -1) return 'stamp-lap';
  return 'stamp-default';
}

function projectStamps(projects) {
  if (!projects) return '<span style="color:var(--muted)">\u2014</span>';
  const list = Array.isArray(projects) ? projects : String(projects).split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return '<span style="color:var(--muted)">\u2014</span>';
  return list.map(p => `<span class="stamp ${projectStampClass(p)}">${escapeHtml(p)}</span>`).join('');
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'badge-completed';
  if (s === 'in progress') return 'badge-progress';
  if (s === 'cancelled') return 'badge-cancelled';
  if (s === 'reassigned') return 'badge-reassigned';
  if (s === 'overdue') return 'badge-overdue';
  return 'badge-pending';
}

function isOverdue(task) {
  if (!task.Deadline) return false;
  if (['Completed', 'Cancelled', 'Reassigned'].includes(task.Status)) return false;
  return new Date(task.Deadline).getTime() < Date.now();
}

function selectOptionsHtml(options, selected) {
  return options.map(o => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
}

function setLoading(html) {
  document.getElementById('content').innerHTML = `<div class="loading-row">${html || 'Loading\u2026'}</div>`;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${sub ? escapeHtml(sub) : ''}</div>`;
}

/* ===================== MODAL ===================== */
function openModal(title, bodyHtml, { onSubmit, submitLabel = 'Save', wide = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" style="${wide ? 'max-width:680px' : ''}">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close" id="modal-close-btn" type="button">&times;</button>
        </div>
        <div id="modal-error" class="form-error hidden"></div>
        <form id="modal-form">${bodyHtml}</form>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
          <button type="submit" form="modal-form" class="btn" id="modal-submit-btn">${escapeHtml(submitLabel)}</button>
        </div>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  document.getElementById('modal-close-btn').onclick = close;
  document.getElementById('modal-cancel-btn').onclick = close;
  document.getElementById('modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') close(); });
  document.getElementById('modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('modal-error');
    errEl.classList.add('hidden');
    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;
    try {
      await onSubmit(new FormData(e.target), close);
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong.';
      errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });
  return close;
}

function checklistHtml(name, options, selectedList) {
  const sel = selectedList || [];
  return `<div class="checklist">${options.map(o => `
    <label><input type="checkbox" name="${name}" value="${escapeHtml(o)}" ${sel.indexOf(o) !== -1 ? 'checked' : ''}> ${escapeHtml(o)}</label>
  `).join('')}</div>`;
}

/* ===================== SESSION ===================== */
function saveSession() {
  localStorage.setItem('fl_session', JSON.stringify({
    token: State.token, role: State.role, fullName: State.fullName, username: State.username,
  }));
}
function loadSession() {
  try {
    const raw = localStorage.getItem('fl_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSession() {
  localStorage.removeItem('fl_session');
  State.token = State.role = State.fullName = State.username = null;
}

async function authedCall(action, params = {}) {
  const data = await Api.call(action, { token: State.token, ...params });
  if (data && data.success === false && /session expired/i.test(data.message || '')) {
    toast('Your session expired \u2014 please log in again.', 'error');
    clearSession();
    showLogin();
    throw new Error(data.message);
  }
  return data;
}

/* ===================== INIT / LOGIN ===================== */
async function init() {
  try {
    const cfg = await Api.call('getConfig');
    if (cfg && cfg.success) State.config = cfg;
  } catch (e) { /* login screen still works without it, just no role dropdown */ }

  const roleSelect = document.getElementById('login-role');
  (State.config.roleOptions || []).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    roleSelect.appendChild(opt);
  });

  document.getElementById('login-form').addEventListener('submit', onLoginSubmit);
  document.getElementById('logout-btn').addEventListener('click', onLogout);

  const saved = loadSession();
  if (saved && saved.token) {
    State.token = saved.token; State.role = saved.role;
    State.fullName = saved.fullName; State.username = saved.username;
    try {
      const info = await Api.call('getSessionInfo', { token: State.token });
      if (info && info.success) {
        showApp();
        return;
      }
    } catch (e) { /* fall through to login */ }
    clearSession();
  }
  showLogin();
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  btn.textContent = 'Logging in\u2026';
  try {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;
    const data = await Api.call('login', { username, password, selectedRole: role || undefined });
    if (!data.success) {
      errEl.textContent = data.message || 'Login failed.';
      errEl.classList.remove('hidden');
      return;
    }
    State.token = data.token; State.role = data.role; State.fullName = data.fullName; State.username = username;
    saveSession();
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Could not reach the server.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log in';
  }
}

function onLogout() {
  Api.call('logoutUser', { token: State.token }).catch(() => {});
  clearSession();
  document.getElementById('login-form').reset();
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('sidebar-user').textContent = State.fullName || State.username;
  document.getElementById('sidebar-role').textContent = State.role;
  buildNav();
  const nav = NAV_BY_ROLE[State.role] || [];
  navigate(nav.length ? nav[0].key : 'account');
}

function buildNav() {
  const nav = document.getElementById('nav');
  const items = NAV_BY_ROLE[State.role] || [];
  nav.innerHTML = items.map(it => `
    <button class="nav-item" data-tab="${it.key}">
      <span class="dot"></span><span class="label">${escapeHtml(it.label)}</span>
    </button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });
}

function navigate(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const [title, sub] = TAB_TITLES[tab] || [tab, ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = sub;
  const renderer = TAB_RENDERERS[tab];
  if (renderer) renderer();
  else document.getElementById('content').innerHTML = emptyState('Nothing here yet');
}

/* ===================== SHARED DATA HELPERS ===================== */
async function fetchContacts(force = false) {
  if (State.contactsCache && !force) return State.contactsCache;
  const data = await authedCall('getContacts');
  State.contactsCache = Array.isArray(data) ? data : [];
  return State.contactsCache;
}

/* ===================== TAB: CONTACTS (Admin/Coordinator) ===================== */
async function renderContacts() {
  setLoading();
  let contacts;
  try { contacts = await fetchContacts(true); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load contacts', err.message); return; }

  const canEdit = State.role === 'Admin';
  const rows = contacts.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.Name)}</strong></td>
      <td>${escapeHtml(c.Tel)}</td>
      <td>${escapeHtml(c.Email)}</td>
      <td>${escapeHtml(c.AffiliateOrg)}</td>
      <td>${escapeHtml(c.Category)}</td>
      <td>${escapeHtml(c.Type)}</td>
      <td>${projectStamps(c.Projects)}</td>
      <td class="row-actions">
        ${canEdit ? `<button class="btn btn-ghost btn-sm" data-edit="${escapeHtml(c.ContactId)}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${escapeHtml(c.ContactId)}">Delete</button>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="toolbar">
      <div style="color:var(--muted); font-size:12.5px;">${contacts.length} contact${contacts.length === 1 ? '' : 's'}</div>
      <div class="toolbar-actions"><button class="btn btn-clay" id="add-contact-btn">+ Add contact</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Tel</th><th>Email</th><th>Org</th><th>Category</th><th>Type</th><th>Projects</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8">${emptyState('No contacts yet', 'Add the first one to get started.')}</td></tr>`}</tbody>
    </table></div>`;

  document.getElementById('add-contact-btn').addEventListener('click', () => openContactModal());
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const c = contacts.find(x => x.ContactId === b.dataset.edit);
    openContactModal(c);
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    try { await authedCall('deleteContact', { contactId: b.dataset.del }); toast('Contact deleted.', 'success'); renderContacts(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

function openContactModal(existing) {
  const isEdit = !!existing;
  const projects = existing ? String(existing.Projects || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  const body = `
    <div class="form-grid">
      <div class="field span-2"><label>Name</label><input type="text" name="Name" required value="${escapeHtml(existing?.Name)}"></div>
      <div class="field"><label>Phone</label><input type="text" name="Tel" value="${escapeHtml(existing?.Tel)}"></div>
      <div class="field"><label>Email</label><input type="email" name="Email" value="${escapeHtml(existing?.Email)}"></div>
      <div class="field span-2"><label>Affiliate organization</label><input type="text" name="AffiliateOrg" value="${escapeHtml(existing?.AffiliateOrg)}"></div>
      <div class="field"><label>Category</label><select name="Category">${selectOptionsHtml(State.config.categoryOptions, existing?.Category)}</select></div>
      <div class="field"><label>Type</label><select name="Type">${selectOptionsHtml(State.config.typeOptions, existing?.Type)}</select></div>
      <div class="field span-2"><label>Projects</label>${checklistHtml('Projects', State.config.projectOptions, projects)}</div>
    </div>`;
  openModal(isEdit ? 'Edit contact' : 'Add contact', body, {
    submitLabel: isEdit ? 'Save changes' : 'Add contact',
    onSubmit: async (fd, close) => {
      const payload = {
        Name: fd.get('Name'), Tel: fd.get('Tel'), Email: fd.get('Email'),
        AffiliateOrg: fd.get('AffiliateOrg'), Category: fd.get('Category'), Type: fd.get('Type'),
        Projects: fd.getAll('Projects'),
      };
      if (isEdit) await authedCall('updateContact', { contactId: existing.ContactId, updates: payload });
      else await authedCall('addContact', { contact: payload });
      toast(isEdit ? 'Contact updated.' : 'Contact added.', 'success');
      close();
      renderContacts();
    },
  });
}

/* ===================== TAB: TASKS (Admin/Coordinator) ===================== */
async function renderTasks() {
  setLoading();
  let tasks;
  try { tasks = await authedCall('getTasks'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load tasks', err.message); return; }
  if (!Array.isArray(tasks)) tasks = [];

  const canManage = State.role === 'Admin';
  const rows = tasks.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.Title)}</strong>${t.Description ? `<div style="color:var(--muted); font-size:12px; margin-top:2px;">${escapeHtml(t.Description)}</div>` : ''}</td>
      <td>${escapeHtml(t.ContactName)}</td>
      <td>${projectStamps(t.Project)}</td>
      <td>${fmtDate(t.Deadline)}</td>
      <td>
        ${canManage
          ? `<select class="pill-select" data-status="${escapeHtml(t.TaskId)}">${selectOptionsHtml(STATUS_OPTIONS, t.Status)}</select>`
          : `<span class="badge ${statusBadgeClass(t.Status)}">${escapeHtml(t.Status)}</span>`}
        ${isOverdue(t) ? `<span class="badge badge-overdue" style="margin-left:6px;">Overdue</span>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="toolbar">
      <div style="color:var(--muted); font-size:12.5px;">${tasks.length} task${tasks.length === 1 ? '' : 's'}</div>
      <div class="toolbar-actions"><button class="btn btn-clay" id="add-task-btn">+ Add task</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Task</th><th>Contact</th><th>Project</th><th>Deadline</th><th>Status</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">${emptyState('No tasks yet', 'Assign the first one.')}</td></tr>`}</tbody>
    </table></div>`;

  document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());
  document.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    try { await authedCall('updateTaskStatus', { taskId: sel.dataset.status, status: sel.value }); toast('Status updated.', 'success'); }
    catch (err) { toast(err.message, 'error'); renderTasks(); }
  }));
}

async function openTaskModal() {
  let contacts = [];
  try { contacts = await fetchContacts(); } catch (e) { /* ignore, still allow manual entry */ }
  const contactOptions = contacts.map(c => `<option value="${escapeHtml(c.ContactId)}">${escapeHtml(c.Name)}</option>`).join('');
  const body = `
    <div class="form-grid">
      <div class="field span-2"><label>Title</label><input type="text" name="Title" required></div>
      <div class="field span-2"><label>Description</label><textarea name="Description"></textarea></div>
      <div class="field"><label>Assigned to (contact)</label><select name="ContactId" required><option value="">Select a contact\u2026</option>${contactOptions}</select></div>
      <div class="field"><label>Project</label><select name="Project">${selectOptionsHtml(State.config.projectOptions)}</select></div>
      <div class="field span-2"><label>Deadline</label><input type="date" name="Deadline" required></div>
    </div>`;
  openModal('Add task', body, {
    submitLabel: 'Assign task',
    onSubmit: async (fd, close) => {
      await authedCall('addTask', {
        task: {
          Title: fd.get('Title'), Description: fd.get('Description'),
          ContactId: fd.get('ContactId'), Project: fd.get('Project'), Deadline: fd.get('Deadline'),
        },
      });
      toast('Task assigned.', 'success');
      close();
      renderTasks();
    },
  });
}

/* ===================== TAB: TEAM LOGINS (Admin) ===================== */
async function renderTeam() {
  setLoading();
  let users;
  try { users = await authedCall('getUsers'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load team logins', err.message); return; }
  if (!Array.isArray(users)) users = [];

  const rows = users.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.Username)}</strong></td>
      <td>${escapeHtml(u.FullName)}</td>
      <td>${escapeHtml(u.Role)}</td>
      <td>${escapeHtml(u.Email)}</td>
      <td>${escapeHtml(u.ContactName) || '<span style="color:var(--muted)">\u2014</span>'}</td>
      <td><span class="badge ${u.Active ? 'badge-active' : 'badge-inactive'}">${u.Active ? 'Active' : 'Inactive'}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-toggle="${escapeHtml(u.UserId)}" data-active="${u.Active ? '1' : '0'}">${u.Active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="toolbar">
      <div style="color:var(--muted); font-size:12.5px;">${users.length} login${users.length === 1 ? '' : 's'}</div>
      <div class="toolbar-actions"><button class="btn btn-clay" id="add-user-btn">+ Create login</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Email</th><th>Linked contact</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">${emptyState('No logins yet')}</td></tr>`}</tbody>
    </table></div>`;

  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());
  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    try { await authedCall('setUserActive', { userId: b.dataset.toggle, active: b.dataset.active !== '1' }); toast('Updated.', 'success'); renderTeam(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

async function openUserModal() {
  let contacts = [];
  try { contacts = await fetchContacts(); } catch (e) { /* ignore */ }
  const contactOptions = contacts.map(c => `<option value="${escapeHtml(c.ContactId)}">${escapeHtml(c.Name)}</option>`).join('');
  const needsLinkRoles = ['Partners', 'Donor', 'Supporter', 'Implementer'];
  const body = `
    <div class="form-grid">
      <div class="field"><label>Username</label><input type="text" name="username" required></div>
      <div class="field"><label>Temporary password</label><input type="text" name="password" required></div>
      <div class="field span-2"><label>Full name</label><input type="text" name="fullName" required></div>
      <div class="field"><label>Email</label><input type="email" name="email"></div>
      <div class="field"><label>Role</label><select name="role" id="user-role-select">${selectOptionsHtml(State.config.roleOptions)}</select></div>
      <div class="field span-2" id="user-contact-field">
        <label>Linked contact</label>
        <select name="contactId"><option value="">Select a contact\u2026</option>${contactOptions}</select>
        <div class="hint">Required for Partners, Donor, Supporter, and Implementer logins \u2014 this scopes what they can see.</div>
      </div>
    </div>`;
  const close = openModal('Create login', body, {
    submitLabel: 'Create login',
    onSubmit: async (fd, closeFn) => {
      await authedCall('createUser', {
        data: {
          username: fd.get('username'), password: fd.get('password'), fullName: fd.get('fullName'),
          email: fd.get('email'), role: fd.get('role'), contactId: fd.get('contactId'),
        },
      });
      toast('Login created.', 'success');
      closeFn();
      renderTeam();
    },
  });
  const roleSelect = document.getElementById('user-role-select');
  const contactField = document.getElementById('user-contact-field');
  const syncContactField = () => { contactField.style.display = needsLinkRoles.includes(roleSelect.value) ? '' : 'none'; };
  roleSelect.addEventListener('change', syncContactField);
  syncContactField();
}

/* ===================== TAB: UPDATES / ANNOUNCEMENTS (Admin/Coordinator) ===================== */
async function renderUpdates() {
  setLoading();
  let history, contacts;
  try {
    [history, contacts] = await Promise.all([authedCall('getUpdateHistory'), fetchContacts()]);
  } catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load announcements', err.message); return; }
  if (!Array.isArray(history)) history = [];

  const rows = history
    .slice()
    .sort((a, b) => new Date(b.SentDate) - new Date(a.SentDate))
    .map(u => `
    <tr>
      <td>${escapeHtml(u.Type)}</td>
      <td>${projectStamps(u.Project)}</td>
      <td>${escapeHtml(u.SentBy)}</td>
      <td>${fmtDateTime(u.SentDate)}</td>
      <td><span class="badge badge-completed">${escapeHtml(u.Status)}</span></td>
      ${State.role === 'Admin' ? `<td><button class="btn btn-ghost btn-sm" data-pdf="${escapeHtml(u.UpdateId)}">Export PDF</button></td>` : '<td></td>'}
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <h2>Send a new update</h2>
      <form id="update-form">
        <div class="form-grid">
          <div class="field"><label>Type</label>
            <select name="type"><option>Update</option><option>Announcement</option></select>
          </div>
          <div class="field"><label>Project</label><select name="project">${selectOptionsHtml(State.config.projectOptions)}</select></div>
          <div class="field span-2"><label>Message</label><textarea name="message" required></textarea></div>
          <div class="field span-2"><label>Recipients</label>${checklistHtml('recipientIds', [], [])}</div>
        </div>
        <div id="update-error" class="form-error hidden" style="margin-top:12px;"></div>
        <div id="update-preview"></div>
        <div style="display:flex; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-ghost" id="preview-btn">Preview</button>
          <button type="submit" class="btn btn-clay">Send to recipients</button>
        </div>
      </form>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Project</th><th>Sent by</th><th>Sent</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">${emptyState('No announcements sent yet')}</td></tr>`}</tbody>
    </table></div>`;

  // Recipients checklist built from contacts
  document.querySelector('#update-form .checklist').outerHTML = `
    <div class="checklist">${contacts.map(c => `
      <label><input type="checkbox" name="recipientIds" value="${escapeHtml(c.ContactId)}"> ${escapeHtml(c.Name)} <span style="color:var(--muted); font-size:11.5px;">(${escapeHtml(c.Email) || 'no email'})</span></label>
    `).join('') || '<span style="color:var(--muted); font-size:12.5px;">No contacts yet.</span>'}</div>`;

  const form = document.getElementById('update-form');
  document.getElementById('preview-btn').addEventListener('click', async () => {
    const fd = new FormData(form);
    const recipientIds = fd.getAll('recipientIds');
    if (!recipientIds.length) { toast('Select at least one recipient to preview.', 'error'); return; }
    try {
      const previews = await authedCall('previewUpdateEmails', { payload: { type: fd.get('type'), project: fd.get('project'), message: fd.get('message'), recipientIds } });
      document.getElementById('update-preview').innerHTML = `
        <div class="form-note" style="margin-top:12px;">
          <strong>${previews.length} email${previews.length === 1 ? '' : 's'} will be sent</strong>
          ${previews.slice(0, 3).map(p => `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--line);"><em>${escapeHtml(p.subject)}</em> \u2014 to ${escapeHtml(p.name)}</div>`).join('')}
          ${previews.length > 3 ? `<div style="margin-top:6px; color:var(--muted);">+ ${previews.length - 3} more\u2026</div>` : ''}
        </div>`;
    } catch (err) { toast(err.message, 'error'); }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('update-error');
    errEl.classList.add('hidden');
    const fd = new FormData(form);
    const recipientIds = fd.getAll('recipientIds');
    if (!recipientIds.length) { errEl.textContent = 'Select at least one recipient.'; errEl.classList.remove('hidden'); return; }
    if (!confirm(`Send this to ${recipientIds.length} recipient(s)?`)) return;
    try {
      const res = await authedCall('sendUpdateEmails', { payload: { type: fd.get('type'), project: fd.get('project'), message: fd.get('message'), recipientIds } });
      toast(`Sent to ${res.count} recipient(s).`, 'success');
      renderUpdates();
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  });

  document.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => downloadPdf('exportSingleUpdatePdf', { updateId: b.dataset.pdf })));
}

/* ===================== TAB: DOCUMENTS (Admin full / Coordinator view-only) ===================== */
async function renderDocuments() {
  setLoading();
  let docs;
  try { docs = await authedCall('getDocuments'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load documents', err.message); return; }
  if (!Array.isArray(docs)) docs = [];
  const isAdmin = State.role === 'Admin';

  const rows = docs.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.Title)}</strong></td>
      <td>${escapeHtml(d.DocType)}</td>
      <td>${projectStamps(d.Project)}</td>
      <td>${escapeHtml(d.Category) || '<span style="color:var(--muted)">\u2014</span>'}</td>
      <td>${escapeHtml(d.UploadedBy)}</td>
      <td>${fmtDate(d.UploadDate)}</td>
      <td class="row-actions">
        <a class="btn btn-ghost btn-sm" href="${escapeHtml(d.FileUrl)}" target="_blank" rel="noopener">Open</a>
        ${isAdmin ? `<button class="btn btn-ghost btn-sm" data-send="${escapeHtml(d.DocumentId)}">Send</button>
        <button class="btn btn-danger btn-sm" data-del="${escapeHtml(d.DocumentId)}">Delete</button>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="toolbar">
      <div style="color:var(--muted); font-size:12.5px;">${docs.length} document${docs.length === 1 ? '' : 's'}</div>
      ${isAdmin ? `<div class="toolbar-actions"><button class="btn btn-clay" id="upload-doc-btn">+ Upload document</button></div>` : ''}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Type</th><th>Project</th><th>Category</th><th>Uploaded by</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">${emptyState('No documents yet')}</td></tr>`}</tbody>
    </table></div>`;

  if (isAdmin) {
    document.getElementById('upload-doc-btn').addEventListener('click', openUploadModal);
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this document? The file will be trashed in Drive too.')) return;
      try { await authedCall('deleteDocument', { documentId: b.dataset.del }); toast('Document deleted.', 'success'); renderDocuments(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    document.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', () => openSendDocModal(b.dataset.send)));
  }
}

function openUploadModal() {
  const body = `
    <div class="form-grid">
      <div class="field span-2"><label>File (PDF or similar)</label><input type="file" name="file" required></div>
      <div class="field span-2"><label>Title</label><input type="text" name="title"></div>
      <div class="field"><label>Document type</label><select name="docType">${selectOptionsHtml(State.config.docTypeOptions)}</select></div>
      <div class="field"><label>Project</label><select name="project"><option value="">General</option>${selectOptionsHtml(State.config.projectOptions)}</select></div>
      <div class="field span-2"><label>Category</label><select name="category"><option value="">General</option>${selectOptionsHtml(State.config.categoryOptions)}</select></div>
    </div>`;
  openModal('Upload document', body, {
    submitLabel: 'Upload',
    onSubmit: async (fd, close) => {
      const file = fd.get('file');
      if (!file || !file.size) throw new Error('Choose a file to upload.');
      const base64Data = await fileToBase64(file);
      await authedCall('uploadDocument', {
        payload: {
          base64Data, mimeType: file.type || 'application/octet-stream', fileName: file.name,
          title: fd.get('title') || file.name, docType: fd.get('docType'), project: fd.get('project'), category: fd.get('category'),
        },
      });
      toast('Document uploaded.', 'success');
      close();
      renderDocuments();
    },
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function openSendDocModal(documentId) {
  const body = `
    <div class="form-grid">
      <div class="field"><label>Category filter</label><select name="category"><option value="">Any category</option>${selectOptionsHtml(State.config.categoryOptions)}</select></div>
      <div class="field"><label>Project filter</label><select name="project"><option value="">Any project</option>${selectOptionsHtml(State.config.projectOptions)}</select></div>
    </div>
    <p class="hint" style="margin-top:8px;">Leave a filter blank to include every contact for that field. Contacts without an email are skipped.</p>`;
  openModal('Send document to contacts', body, {
    submitLabel: 'Send',
    onSubmit: async (fd, close) => {
      const res = await authedCall('sendDocumentToContacts', { documentId, filter: { category: fd.get('category'), project: fd.get('project') } });
      toast(`Sent to ${res.count} contact(s).`, 'success');
      close();
      renderDocuments();
    },
  });
}

/* ===================== TAB: REASSIGNMENT REQUESTS (Admin) ===================== */
async function renderReassign() {
  setLoading();
  let reqs;
  try { reqs = await authedCall('getReassignRequests'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load requests', err.message); return; }
  if (!Array.isArray(reqs)) reqs = [];

  const rows = reqs.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.TaskTitle)}</strong><div style="color:var(--muted); font-size:12px;">${projectStamps(r.TaskProject)}</div></td>
      <td>${escapeHtml(r.RequestedByName)}</td>
      <td>${r.RequestType === 'date' ? 'New deadline' : 'Reassign person'}</td>
      <td>${r.RequestType === 'date'
        ? `${fmtDate(r.CurrentDeadline)} &rarr; ${fmtDate(r.NewDeadline)}`
        : `&rarr; ${escapeHtml(r.NewContactName) || '(unknown)'}`}</td>
      <td style="max-width:220px;">${escapeHtml(r.Note)}</td>
      <td><span class="badge ${r.Status === 'Approved' ? 'badge-completed' : r.Status === 'Denied' ? 'badge-cancelled' : 'badge-pending'}">${escapeHtml(r.Status)}</span></td>
      <td class="row-actions">
        ${r.Status === 'Pending' ? `
          <button class="btn btn-ghost btn-sm" data-approve="${escapeHtml(r.RequestId)}">Approve</button>
          <button class="btn btn-danger btn-sm" data-deny="${escapeHtml(r.RequestId)}">Deny</button>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Task</th><th>Requested by</th><th>Type</th><th>Change</th><th>Note</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">${emptyState('No requests yet')}</td></tr>`}</tbody>
    </table></div>`;

  document.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => resolveReq(b.dataset.approve, 'approve')));
  document.querySelectorAll('[data-deny]').forEach(b => b.addEventListener('click', () => resolveReq(b.dataset.deny, 'deny')));
}

async function resolveReq(requestId, action) {
  if (!confirm(`${action === 'approve' ? 'Approve' : 'Deny'} this request?`)) return;
  try { await authedCall('resolveReassignRequest', { requestId, decision: { action } }); toast('Request updated.', 'success'); renderReassign(); }
  catch (err) { toast(err.message, 'error'); }
}

/* ===================== TAB: ALL COMMENTS (Admin) ===================== */
async function renderAllComments() {
  setLoading();
  let comments;
  try { comments = await authedCall('getAllComments'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load comments', err.message); return; }
  if (!Array.isArray(comments)) comments = [];

  const rows = comments.map(c => `
    <tr>
      <td>${escapeHtml(c.DocumentTitle)}</td>
      <td>${escapeHtml(c.CommentBy)} <span style="color:var(--muted); font-size:11.5px;">(${escapeHtml(c.CommentByRole)})</span></td>
      <td style="max-width:360px;">${escapeHtml(c.Comment)}</td>
      <td>${fmtDateTime(c.CommentDate)}</td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Document</th><th>By</th><th>Comment</th><th>Date</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">${emptyState('No comments yet')}</td></tr>`}</tbody>
    </table></div>`;
}

/* ===================== TAB: REPORTS / PDF EXPORT (Admin) ===================== */
function renderReports() {
  document.getElementById('content').innerHTML = `
    <div class="card">
      <h2>Export as PDF</h2>
      <div class="toolbar-actions" style="margin-bottom:16px;">
        <button class="btn btn-ghost" id="exp-contacts">Contacts</button>
        <button class="btn btn-ghost" id="exp-tasks">Tasks</button>
        <button class="btn btn-ghost" id="exp-history">Announcement history</button>
      </div>
      <div class="field" style="max-width:280px;">
        <label>Project report</label>
        <select id="exp-project-select">${selectOptionsHtml(State.config.projectOptions)}</select>
      </div>
      <button class="btn btn-clay" id="exp-project" style="margin-top:10px;">Export project report</button>
    </div>`;
  document.getElementById('exp-contacts').addEventListener('click', () => downloadPdf('exportContactsPdf'));
  document.getElementById('exp-tasks').addEventListener('click', () => downloadPdf('exportTasksPdf'));
  document.getElementById('exp-history').addEventListener('click', () => downloadPdf('exportUpdateHistoryPdf'));
  document.getElementById('exp-project').addEventListener('click', () => downloadPdf('exportProjectReportPdf', { project: document.getElementById('exp-project-select').value }));
}

async function downloadPdf(action, params = {}) {
  toast('Preparing PDF\u2026');
  try {
    const res = await authedCall(action, params);
    if (!res || res.success === false) throw new Error(res && res.message || 'Export failed.');
    const bytes = atob(res.base64Data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.fileName || 'export.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) { toast(err.message, 'error'); }
}

/* ===================== TAB: MY TASKS (Implementer) ===================== */
async function renderMyTasks() {
  setLoading();
  let tasks;
  try { tasks = await authedCall('getMyTasks'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load your tasks', err.message); return; }
  if (!Array.isArray(tasks)) tasks = [];

  const rows = tasks.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.Title)}</strong>${t.Description ? `<div style="color:var(--muted); font-size:12px; margin-top:2px;">${escapeHtml(t.Description)}</div>` : ''}</td>
      <td>${projectStamps(t.Project)}</td>
      <td>${fmtDate(t.Deadline)}</td>
      <td><span class="badge ${statusBadgeClass(t.Status)}">${escapeHtml(t.Status)}</span> ${isOverdue(t) ? `<span class="badge badge-overdue">Overdue</span>` : ''}</td>
      <td class="row-actions">
        ${!['Completed', 'Cancelled'].includes(t.Status) ? `
          <button class="btn btn-ghost btn-sm" data-done="${escapeHtml(t.TaskId)}">Mark done</button>
          <button class="btn btn-ghost btn-sm" data-request="${escapeHtml(t.TaskId)}">Request change</button>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Task</th><th>Project</th><th>Deadline</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">${emptyState('No tasks assigned yet')}</td></tr>`}</tbody>
    </table></div>`;

  document.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Mark this task as done?')) return;
    try { await authedCall('markMyTaskDone', { taskId: b.dataset.done }); toast('Marked as done.', 'success'); renderMyTasks(); }
    catch (err) { toast(err.message, 'error'); }
  }));
  document.querySelectorAll('[data-request]').forEach(b => b.addEventListener('click', () => openReassignRequestModal(b.dataset.request, tasks.find(t => t.TaskId === b.dataset.request))));
}

async function openReassignRequestModal(taskId, task) {
  let contactOptions = [];
  try {
    const opts = await authedCall('getContactOptionsForReassignment');
    contactOptions = Array.isArray(opts) ? opts : [];
  } catch (e) { /* if this fails, "person" requests just won't have options */ }

  const body = `
    <div class="form-grid">
      <div class="field span-2"><label>What would you like to change?</label>
        <select name="requestType" id="req-type-select">
          <option value="date">Request a new deadline</option>
          <option value="person">Reassign to someone else</option>
        </select>
      </div>
      <div class="field span-2" id="req-date-field"><label>Requested new deadline</label><input type="date" name="newDeadline"></div>
      <div class="field span-2 hidden" id="req-person-field"><label>Reassign to</label>
        <select name="newContactId"><option value="">Select someone\u2026</option>${contactOptions.map(c => `<option value="${escapeHtml(c.ContactId)}">${escapeHtml(c.Name)}</option>`).join('')}</select>
      </div>
      <div class="field span-2"><label>Note (required)</label><textarea name="note" required placeholder="Why is this change needed?"></textarea></div>
    </div>`;
  openModal(`Request change \u2014 ${task ? task.Title : ''}`, body, {
    submitLabel: 'Submit request',
    onSubmit: async (fd, close) => {
      await authedCall('requestTaskReassignment', {
        payload: {
          taskId, requestType: fd.get('requestType'),
          newDeadline: fd.get('newDeadline'), newContactId: fd.get('newContactId'), note: fd.get('note'),
        },
      });
      toast('Request sent to the admin team.', 'success');
      close();
      renderMyTasks();
    },
  });
  const typeSelect = document.getElementById('req-type-select');
  const dateField = document.getElementById('req-date-field');
  const personField = document.getElementById('req-person-field');
  typeSelect.addEventListener('change', () => {
    const isDate = typeSelect.value === 'date';
    dateField.classList.toggle('hidden', !isDate);
    personField.classList.toggle('hidden', isDate);
  });
}

/* ===================== TAB: MY DOCUMENTS (scoped roles) ===================== */
async function renderMyDocuments() {
  setLoading();
  let docs;
  try { docs = await authedCall('getMyDocuments'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load documents', err.message); return; }
  if (!Array.isArray(docs)) docs = [];

  const rows = docs.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.Title)}</strong></td>
      <td>${escapeHtml(d.DocType)}</td>
      <td>${projectStamps(d.Project)}</td>
      <td>${fmtDate(d.UploadDate)}</td>
      <td><a class="btn btn-ghost btn-sm" href="${escapeHtml(d.FileUrl)}" target="_blank" rel="noopener">Open</a></td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Type</th><th>Project</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">${emptyState('No documents shared with you yet')}</td></tr>`}</tbody>
    </table></div>`;
}

/* ===================== TAB: MY UPDATES (scoped roles) ===================== */
async function renderMyUpdates() {
  setLoading();
  let updates;
  try { updates = await authedCall('getMyUpdates'); }
  catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load announcements', err.message); return; }
  if (!Array.isArray(updates)) updates = [];

  const cards = updates.map(u => `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>${escapeHtml(u.Type)} \u2014 ${projectStamps(u.Project)}</strong>
        <span style="color:var(--muted); font-size:12px;">${fmtDateTime(u.SentDate)}</span>
      </div>
      <p style="margin:0; white-space:pre-wrap;">${escapeHtml(u.Message)}</p>
    </div>`).join('');

  document.getElementById('content').innerHTML = cards || emptyState('No announcements yet', 'You\u2019ll see project updates here as they\u2019re sent.');
}

/* ===================== TAB: MY COMMENTS (Partners/Donor/Supporter) ===================== */
async function renderMyComments() {
  setLoading();
  let comments, docs;
  try {
    [comments, docs] = await Promise.all([authedCall('getMyComments'), authedCall('getMyDocuments')]);
  } catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load comments', err.message); return; }
  if (!Array.isArray(comments)) comments = [];
  if (!Array.isArray(docs)) docs = [];

  const rows = comments.map(c => `
    <tr>
      <td>${escapeHtml(c.DocumentTitle)}</td>
      <td style="max-width:400px;">${escapeHtml(c.Comment)}</td>
      <td>${fmtDateTime(c.CommentDate)}</td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <h2>Leave a comment</h2>
      <form id="comment-form">
        <div class="form-grid">
          <div class="field span-2"><label>About which document?</label>
            <select name="documentId"><option value="">General comment (not tied to a document)</option>${docs.map(d => `<option value="${escapeHtml(d.DocumentId)}">${escapeHtml(d.Title)}</option>`).join('')}</select>
          </div>
          <div class="field span-2"><label>Comment</label><textarea name="comment" required></textarea></div>
        </div>
        <button type="submit" class="btn btn-clay" style="margin-top:12px;">Post comment</button>
      </form>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Document</th><th>Comment</th><th>Date</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3">${emptyState('You haven\u2019t left any comments yet')}</td></tr>`}</tbody>
    </table></div>`;

  document.getElementById('comment-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await authedCall('addDocumentComment', { documentId: fd.get('documentId'), comment: fd.get('comment') });
      toast('Comment posted.', 'success');
      renderMyComments();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ===================== TAB: ACCOUNT (all roles) ===================== */
function renderAccount() {
  document.getElementById('content').innerHTML = `
    <div class="card" style="max-width:420px;">
      <h2>Signed in as</h2>
      <p style="margin:0 0 4px;"><strong>${escapeHtml(State.fullName || State.username)}</strong></p>
      <p style="margin:0; color:var(--muted); font-size:13px;">${escapeHtml(State.username)} \u2014 ${escapeHtml(State.role)}</p>
    </div>
    <div class="card" style="max-width:420px;">
      <h2>Change password</h2>
      <form id="pw-form">
        <div class="field"><label>Current password</label><input type="password" name="oldPassword" required></div>
        <div class="field"><label>New password</label><input type="password" name="newPassword" required minlength="6"></div>
        <div id="pw-error" class="form-error hidden"></div>
        <button type="submit" class="btn">Update password</button>
      </form>
    </div>`;
  document.getElementById('pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('pw-error');
    errEl.classList.add('hidden');
    const fd = new FormData(e.target);
    try {
      const res = await authedCall('changeOwnPassword', { oldPassword: fd.get('oldPassword'), newPassword: fd.get('newPassword') });
      if (res.success === false) { errEl.textContent = res.message; errEl.classList.remove('hidden'); return; }
      toast('Password updated.', 'success');
      e.target.reset();
    } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  });
}

/* ===================== ROUTER TABLE ===================== */
const TAB_RENDERERS = {
  contacts: renderContacts,
  tasks: renderTasks,
  team: renderTeam,
  updates: renderUpdates,
  documents: renderDocuments,
  reassign: renderReassign,
  comments: renderAllComments,
  reports: renderReports,
  account: renderAccount,
  mytasks: renderMyTasks,
  mydocuments: renderMyDocuments,
  myupdates: renderMyUpdates,
  mycomments: renderMyComments,
};

document.addEventListener('DOMContentLoaded', init);
