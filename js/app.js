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

function toast(message, type = '') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'form-error' + (type === 'success' ? '' : '');
  if (type === 'success') {
    el.style.background = '#E8F0F9';
    el.style.color = 'var(--primary-dk)';
    el.style.borderColor = 'var(--accent)';
  }
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function projectStamps(projects) {
  if (!projects) return '<span style="color:var(--ink-soft)">\u2014</span>';
  const list = Array.isArray(projects) ? projects : String(projects).split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return '<span style="color:var(--ink-soft)">\u2014</span>';
  return list.map(p => `<span class="badge" style="margin-right:4px;">${escapeHtml(p)}</span>`).join('');
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'badge';
  if (s === 'in progress') return 'badge warn';
  if (s === 'cancelled' || s === 'overdue') return 'badge danger';
  return 'badge warn';
}

function isOverdue(task) {
  if (!task.Deadline) return false;
  if (['Completed', 'Cancelled', 'Reassigned'].includes(task.Status)) return false;
  return new Date(task.Deadline).getTime() < Date.now();
}

function selectOptionsHtml(options, selected) {
  return (options || []).map(o => `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
}

function setLoading(html) {
  document.getElementById('content').innerHTML = `<div class="empty-state">${html || 'Loading\u2026'}</div>`;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${sub ? `<div style="margin-top:4px;">${escapeHtml(sub)}</div>` : ''}</div>`;
}

/* ===================== INLINE DRAWER BUILDER ===================== */
function buildDrawerHtml({ id, title, formBodyHtml, submitLabel = 'Save' }) {
  return `
    <div class="drawer" id="${id}">
      <div class="drawer-inner">
        <div class="drawer-panel">
          <div class="drawer-panel-header">
            <h3>${escapeHtml(title)}</h3>
            <button class="btn btn-ghost btn-sm drawer-cancel-btn" type="button">&times;</button>
          </div>
          <div class="form-error hidden drawer-error"></div>
          <form class="drawer-form">
            ${formBodyHtml}
            <div class="drawer-actions">
              <button type="button" class="btn btn-ghost drawer-cancel-btn">Cancel</button>
              <button type="submit" class="btn">${escapeHtml(submitLabel)}</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
}

function setupDrawer({ drawerEl, onOpen, onSubmit, onClose }) {
  if (!drawerEl) return;
  const form = drawerEl.querySelector('.drawer-form');
  const errEl = drawerEl.querySelector('.drawer-error');

  const closeDrawer = () => {
    drawerEl.classList.remove('open');
    if (form) form.reset();
    if (errEl) errEl.classList.add('hidden');
    if (onClose) onClose();
  };

  drawerEl.querySelectorAll('.drawer-cancel-btn').forEach(btn => {
    btn.onclick = closeDrawer;
  });

  if (form && onSubmit) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (errEl) errEl.classList.add('hidden');
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await onSubmit(new FormData(form), closeDrawer);
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Something went wrong.';
          errEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  return {
    open: () => {
      drawerEl.classList.add('open');
      if (onOpen) onOpen();
    },
    close: closeDrawer,
  };
}

function checklistHtml(name, options, selectedList) {
  const sel = selectedList || [];
  return `
    <div class="checkbox-row">
      ${(options || []).map(o => `
        <label>
          <input type="checkbox" name="${name}" value="${escapeHtml(o)}" ${sel.includes(o) ? 'checked' : ''}>
          ${escapeHtml(o)}
        </label>
      `).join('')}
    </div>`;
}

/* ===================== SESSION ===================== */
function saveSession() {
  sessionStorage.setItem('fl_session', JSON.stringify({
    token: State.token, role: State.role, fullName: State.fullName, username: State.username,
  }));
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('fl_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function clearSession() {
  sessionStorage.removeItem('fl_session');
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
  } catch (e) { /* login screen still works without it */ }

  const roleSelect = document.getElementById('login-role');
  if (roleSelect) {
    (State.config.roleOptions || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      roleSelect.appendChild(opt);
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', onLoginSubmit);
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', onLogout);

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
  const form = document.getElementById('login-form');
  if (form) form.reset();
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  const userEl = document.getElementById('sidebar-user');
  const roleEl = document.getElementById('sidebar-role');
  if (userEl) userEl.textContent = State.fullName || State.username;
  if (roleEl) roleEl.textContent = State.role;
  buildNav();
  const nav = NAV_BY_ROLE[State.role] || [];
  navigate(nav.length ? nav[0].key : 'account');
}

function buildNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const items = NAV_BY_ROLE[State.role] || [];
  nav.innerHTML = items.map(it => `
    <button class="tab-item" data-tab="${it.key}">
      ${escapeHtml(it.label)}
    </button>`).join('');
  nav.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });
}

function navigate(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.tab-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const [title, sub] = TAB_TITLES[tab] || [tab, ''];
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
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
  const drawerFormBody = `
    <div class="form-grid">
      <div class="field span-full"><label>Name</label><input type="text" name="Name" required></div>
      <div class="field"><label>Phone</label><input type="text" name="Tel"></div>
      <div class="field"><label>Email</label><input type="email" name="Email"></div>
      <div class="field"><label>Affiliate organization</label><input type="text" name="AffiliateOrg"></div>
      <div class="field"><label>Category</label><select name="Category">${selectOptionsHtml(State.config.categoryOptions)}</select></div>
      <div class="field"><label>Type</label><select name="Type">${selectOptionsHtml(State.config.typeOptions)}</select></div>
      <div class="field span-full"><label>Projects</label>${checklistHtml('Projects', State.config.projectOptions, [])}</div>
    </div>`;

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
        ${canEdit ? `<button class="btn btn-ghost btn-sm" data-del="${escapeHtml(c.ContactId)}">Delete</button>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Contacts (${contacts.length})</h2>
        ${canEdit ? '<button class="btn btn-sm" id="add-contact-btn">+ Add contact</button>' : ''}
      </div>
      ${canEdit ? buildDrawerHtml({ id: 'contact-drawer', title: 'Add new contact', formBodyHtml: drawerFormBody, submitLabel: 'Add contact' }) : ''}
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Tel</th><th>Email</th><th>Org</th><th>Category</th><th>Type</th><th>Projects</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">${emptyState('No contacts yet', 'Add the first one to get started.')}</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  if (canEdit) {
    const drawerController = setupDrawer({
      drawerEl: document.getElementById('contact-drawer'),
      onSubmit: async (fd, close) => {
        const payload = {
          Name: fd.get('Name'), Tel: fd.get('Tel'), Email: fd.get('Email'),
          AffiliateOrg: fd.get('AffiliateOrg'), Category: fd.get('Category'), Type: fd.get('Type'),
          Projects: fd.getAll('Projects'),
        };
        await authedCall('addContact', { contact: payload });
        toast('Contact added.', 'success');
        close();
        renderContacts();
      }
    });

    document.getElementById('add-contact-btn').addEventListener('click', () => drawerController.open());

    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this contact? This cannot be undone.')) return;
      try { await authedCall('deleteContact', { contactId: b.dataset.del }); toast('Contact deleted.', 'success'); renderContacts(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
}

/* ===================== TAB: TASKS (Admin/Coordinator) ===================== */
async function renderTasks() {
  setLoading();
  let tasks, contacts = [];
  try { 
    [tasks, contacts] = await Promise.all([authedCall('getTasks'), fetchContacts()]);
  } catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load tasks', err.message); return; }
  if (!Array.isArray(tasks)) tasks = [];

  const canManage = State.role === 'Admin';
  const contactOptions = contacts.map(c => `<option value="${escapeHtml(c.ContactId)}">${escapeHtml(c.Name)}</option>`).join('');
  const drawerFormBody = `
    <div class="form-grid">
      <div class="field span-full"><label>Title</label><input type="text" name="Title" required></div>
      <div class="field span-full"><label>Description</label><input type="text" name="Description"></div>
      <div class="field"><label>Assigned to (contact)</label><select name="ContactId" required><option value="">Select a contact\u2026</option>${contactOptions}</select></div>
      <div class="field"><label>Project</label><select name="Project">${selectOptionsHtml(State.config.projectOptions)}</select></div>
      <div class="field"><label>Deadline</label><input type="date" name="Deadline" required></div>
    </div>`;

  const rows = tasks.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.Title)}</strong>${t.Description ? `<div style="color:var(--ink-soft); font-size:12px; margin-top:2px;">${escapeHtml(t.Description)}</div>` : ''}</td>
      <td>${escapeHtml(t.ContactName)}</td>
      <td>${projectStamps(t.Project)}</td>
      <td>${fmtDate(t.Deadline)}</td>
      <td>
        ${canManage
          ? `<select class="field" style="padding:4px 8px; font-size:12px; margin:0;" data-status="${escapeHtml(t.TaskId)}">${selectOptionsHtml(STATUS_OPTIONS, t.Status)}</select>`
          : `<span class="${statusBadgeClass(t.Status)}">${escapeHtml(t.Status)}</span>`}
        ${isOverdue(t) ? `<span class="badge danger" style="margin-left:6px;">Overdue</span>` : ''}
      </td>
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Tasks (${tasks.length})</h2>
        <button class="btn btn-sm" id="add-task-btn">+ Add task</button>
      </div>
      ${buildDrawerHtml({ id: 'task-drawer', title: 'Assign new task', formBodyHtml: drawerFormBody, submitLabel: 'Assign task' })}
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Task</th><th>Contact</th><th>Project</th><th>Deadline</th><th>Status</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5">${emptyState('No tasks yet', 'Assign the first one.')}</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  const drawerController = setupDrawer({
    drawerEl: document.getElementById('task-drawer'),
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
    }
  });

  document.getElementById('add-task-btn').addEventListener('click', () => drawerController.open());

  document.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    try { await authedCall('updateTaskStatus', { taskId: sel.dataset.status, status: sel.value }); toast('Status updated.', 'success'); }
    catch (err) { toast(err.message, 'error'); renderTasks(); }
  }));
}

/* ===================== TAB: TEAM LOGINS (Admin) ===================== */
async function renderTeam() {
  setLoading();
  let users, contacts = [];
  try { 
    [users, contacts] = await Promise.all([authedCall('getUsers'), fetchContacts()]);
  } catch (err) { document.getElementById('content').innerHTML = emptyState('Could not load team logins', err.message); return; }
  if (!Array.isArray(users)) users = [];

  const contactOptions = contacts.map(c => `<option value="${escapeHtml(c.ContactId)}">${escapeHtml(c.Name)}</option>`).join('');
  const drawerFormBody = `
    <div class="form-grid">
      <div class="field"><label>Username</label><input type="text" name="username" required></div>
      <div class="field"><label>Temporary password</label><input type="text" name="password" required></div>
      <div class="field"><label>Role</label><select name="role" id="user-role-select">${selectOptionsHtml(State.config.roleOptions)}</select></div>
      <div class="field span-full"><label>Full name</label><input type="text" name="fullName" required></div>
      <div class="field span-full"><label>Email</label><input type="email" name="email"></div>
      <div class="field span-full" id="user-contact-field">
        <label>Linked contact</label>
        <select name="contactId"><option value="">Select a contact\u2026</option>${contactOptions}</select>
        <div class="hint">Required for Partners, Donor, Supporter, and Implementer logins.</div>
      </div>
      
       <div class="field span-full" id="user-contact-field">
        <label>Linked contact</label>
        <select name="contactId"><option value="">Select a contact&hellip;</option>${contactOptions}</select>
        <div class="hint">Required for Partners, Donor, Supporter, and Implementer logins.</div>
      </div>
      <div class="field span-full hidden" id="user-coord-projects-field">
        <label>Assigned project(s)</label>
        ${checklistHtml('assignedProjects', State.config.projectOptions, [])}
      </div>
    </div>`;
  
  const rows = users.map(u => {
    const scopeBits = [];
   if (u.AssignedProjects) scopeBits.push(projectStamps(u.AssignedProjects));
    const scopeCell = u.Role === 'Coordinator'
      ? (scopeBits.length ? scopeBits.join(' ') : '<span style="color:var(--ink-soft)">Unscoped</span>')
      : (escapeHtml(u.ContactName) || '<span style="color:var(--ink-soft)">\u2014</span>');
    return `
    <tr>
      <td><strong>${escapeHtml(u.Username)}</strong></td>
      <td>${escapeHtml(u.FullName)}</td>
      <td>${escapeHtml(u.Role)}</td>
      <td>${escapeHtml(u.Email)}</td>
      <td>${scopeCell}</td>
      <td><span class="${u.Active ? 'badge' : 'badge danger'}">${u.Active ? 'Active' : 'Inactive'}</span></td>
      <td><button class="btn btn-ghost btn-sm" data-toggle="${escapeHtml(u.UserId)}" data-active="${u.Active ? '1' : '0'}">${u.Active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Team Logins (${users.length})</h2>
        <button class="btn btn-sm" id="add-user-btn">+ Create login</button>
      </div>
      ${buildDrawerHtml({ id: 'user-drawer', title: 'Create new user login', formBodyHtml: drawerFormBody, submitLabel: 'Create login' })}
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Email</th><th>Linked contact / scope</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7">${emptyState('No logins yet')}</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  const needsLinkRoles = ['Partners', 'Donor', 'Supporter', 'Implementer'];
  const drawerController = setupDrawer({
    drawerEl: document.getElementById('user-drawer'),
    onOpen: () => {
      const roleSelect = document.getElementById('user-role-select');
      const contactField = document.getElementById('user-contact-field');
      const coordProjectsField = document.getElementById('user-coord-projects-field');
      const syncRoleFields = () => {
        if (!roleSelect) return;
        contactField.style.display = needsLinkRoles.includes(roleSelect.value) ? '' : 'none';
        const isCoordinator = roleSelect.value === 'Coordinator';
        coordProjectsField.classList.toggle('hidden', !isCoordinator);
      };
      if (roleSelect) {
        roleSelect.onchange = syncRoleFields;
        syncRoleFields();
      }
    },
    onSubmit: async (fd, close) => {
      const role = fd.get('role');
      const data = {
        username: fd.get('username'), password: fd.get('password'), fullName: fd.get('fullName'),
        email: fd.get('email'), role, contactId: fd.get('contactId'),
      };
            if (role === 'Coordinator') {
        data.assignedProjects = fd.getAll('assignedProjects');
      }
      await authedCall('createUser', { data });
      toast('Login created.', 'success');
      close();
      renderTeam();
    }
  });

  document.getElementById('add-user-btn').addEventListener('click', () => drawerController.open());

  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    try { await authedCall('setUserActive', { userId: b.dataset.toggle, active: b.dataset.active !== '1' }); toast('Updated.', 'success'); renderTeam(); }
    catch (err) { toast(err.message, 'error'); }
  }));
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
      <td><span class="badge">${escapeHtml(u.Status)}</span></td>
      ${State.role === 'Admin' ? `<td><button class="btn btn-ghost btn-sm" data-pdf="${escapeHtml(u.UpdateId)}">Export PDF</button></td>` : '<td></td>'}
    </tr>`).join('');

  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Send a new update</h2>
      </div>
      <form id="update-form">
        <div class="form-grid">
          <div class="field"><label>Type</label>
            <select name="type"><option>Update</option><option>Announcement</option></select>
          </div>
          <div class="field"><label>Project</label><select name="project">${selectOptionsHtml(State.config.projectOptions)}</select></div>
          <div class="field span-full"><label>Message</label><textarea name="message" class="field" style="width:100%; min-height:80px;" required></textarea></div>
          <div class="field span-full"><label>Recipients</label>
            ${checklistHtml('recipientIds', contacts.map(c => c.Name), [])}
          </div>
        </div>
        <div id="update-error" class="form-error hidden" style="margin-top:12px;"></div>
        <div id="update-preview"></div>
        <div style="display:flex; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-ghost" id="preview-btn">Preview</button>
          <button type="submit" class="btn">Send to recipients</button>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-header">
        <h2>Announcement History</h2>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Type</th><th>Project</th><th>Sent by</th><th>Sent</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">${emptyState('No announcements sent yet')}</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  const form = document.getElementById('update-form');
  document.getElementById('preview-btn').addEventListener('click', async () => {
    const fd = new FormData(form);
    const recipientIndexes = fd.getAll('recipientIds');
    if (!recipientIndexes.length) { toast('Select at least one recipient to preview.', 'error'); return; }
    try {
      const recipientIds = recipientIndexes.map(idx => contacts.find(c => c.Name === idx)?.ContactId).filter(Boolean);
      const previews = await authedCall('previewUpdateEmails', { payload: { type: fd.get('type'), project: fd.get('project'), message: fd.get('message'), recipientIds } });
      document.getElementById('update-preview').innerHTML = `
        <div class="card" style="margin-top:12px; background:var(--bg);">
          <strong>${previews.length} email${previews.length === 1 ? '' : 's'} will be sent</strong>
          ${previews.slice(0, 3).map(p => `<div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--line);"><em>${escapeHtml(p.subject)}</em> \u2014 to ${escapeHtml(p.name)}</div>`).join('')}
          ${previews.length > 3 ? `<div style="margin-top:6px; color:var(--ink-soft);">+ ${previews.length - 3} more\u2026</div>` : ''}
        </div>`;
    } catch (err) { toast(err.message, 'error'); }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('update-error');
    errEl.classList.add('hidden');
    const fd = new FormData(form);
    const recipientNames = fd.getAll('recipientIds');
    const recipientIds = recipientNames.map(name => contacts.find(c => c.Name === name)?.ContactId).filter(Boolean);
    if (!recipientIds.length) { errEl.textContent = 'Select at least one recipient.'; errEl.classList.remove('hidden'); return; }
    if (!confirm(`Send this to ${recipientIds.length} recipient(s)?`)) return;
    try {
      await authedCall('sendUpdateEmails', {
        payload: {
          type: fd.get('type'),
          project: fd.get('project'),
          message: fd.get('message'),
          recipientIds,
        }
      });
      toast('Update sent successfully.', 'success');
      renderUpdates();
    } catch (err) {
      errEl.textContent = err.message || 'Failed to send update.';
      errEl.classList.remove('hidden');
    }
  });
}

/* ===================== TAB RENDERER REGISTRY ===================== */
const TAB_RENDERERS = {
  contacts: renderContacts,
  tasks: renderTasks,
  team: renderTeam,
  updates: renderUpdates,
  documents: () => { document.getElementById('content').innerHTML = emptyState('Documents view'); },
  reassign: () => { document.getElementById('content').innerHTML = emptyState('Reassignment requests view'); },
  comments: () => { document.getElementById('content').innerHTML = emptyState('Comments view'); },
  reports: () => { document.getElementById('content').innerHTML = emptyState('Reports view'); },
  account: () => { document.getElementById('content').innerHTML = emptyState('Account view', `Logged in as ${State.fullName || State.username}`); },
  mytasks: () => { document.getElementById('content').innerHTML = emptyState('My tasks view'); },
  mydocuments: () => { document.getElementById('content').innerHTML = emptyState('My documents view'); },
  myupdates: () => { document.getElementById('content').innerHTML = emptyState('My announcements view'); },
  mycomments: () => { document.getElementById('content').innerHTML = emptyState('My comments view'); },
};

/* Start the app when DOM is ready */
document.addEventListener('DOMContentLoaded', init);
/**
 * Retrieves the scoped list of available projects for the active user session.
 * - Coordinators obtain only their AssignedProjects list via `getMyScope`.
 * - Admins receive the full `PROJECT_OPTIONS` array.
 */
async function fetchScopedProjectOptions() {
  if (State.role === 'Coordinator') {
    try {
      const res = await apiCall('getMyScope', { token: State.token });
      if (res && res.success && Array.isArray(res.projects)) {
        return res.projects;
      }
    } catch (e) {
      console.error('Failed to fetch scoped projects:', e);
    }
    return [];
  }
  return State.config.projectOptions || [];
}

/**
 * Builds project selection options (dropdown or checkbox checklist)
 * based on role scoping.
 */
async function buildProjectSelectOptions(selectElementId, isMultiChecklist = false) {
  const options = await fetchScopedProjectOptions();
  const container = document.getElementById(selectElementId);
  if (!container) return;

  if (isMultiChecklist) {
    container.innerHTML = options.map(p => `
      <label class="checkbox-item">
        <input type="checkbox" name="projects" value="${p}">
        <span>${p}</span>
      </label>
    `).join('');
  } else {
    container.innerHTML = `<option value="">Select Project</option>` + 
      options.map(p => `<option value="${p}">${p}</option>`).join('');
  }
}

// Call `buildProjectSelectOptions` when initializing drawers:
// 1. Add Contact Drawer -> buildProjectSelectOptions('contactProjectsInput', true)
// 2. Add Task Drawer -> buildProjectSelectOptions('taskProjectSelect')
// 3. Send Update/Announcement Drawer -> buildProjectSelectOptions('updateProjectSelect')
