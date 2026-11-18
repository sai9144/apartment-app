// app.js - Green Valley Apartments PWA
const API = '/api';
let currentUser = null;
let currentTab = 'dashboard';

// DOM refs
const screens = {
  login: document.getElementById('screen-login'),
  register: document.getElementById('screen-register'),
  app: document.getElementById('screen-app'),
};
const mainEl = document.getElementById('app-main');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const bottomNav = document.getElementById('bottom-nav');
const headerTitle = document.getElementById('header-title');
const notifBadge = document.getElementById('notif-badge');

// --- Utility ---
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function toast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
}

function avatarEl(name, size = 44) {
  const el = document.createElement('div');
  el.className = size === 44 ? 'visitor-avatar' : 'avatar';
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  el.textContent = initials(name);
  return el;
}

// --- Auth ---
async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('token', data.token);
  currentUser = data.user;
  return data.user;
}

async function register(data) {
  const res = await api('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  localStorage.setItem('token', res.token);
  currentUser = res.user;
  return res.user;
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  showScreen('login');
}

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const user = await api('/auth/me');
    currentUser = user;
    return true;
  } catch {
    localStorage.removeItem('token');
    return false;
  }
}

// --- Drawer ---
function openDrawer() { drawer.classList.add('open'); drawerOverlay.classList.add('visible'); drawer.setAttribute('aria-hidden', 'false'); }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('visible'); drawer.setAttribute('aria-hidden', 'true'); }
function updateDrawer() {
  document.getElementById('drawer-name').textContent = currentUser?.name || 'Resident';
  document.getElementById('drawer-apartment').textContent = currentUser?.apartment || '';
  document.getElementById('drawer-avatar').textContent = initials(currentUser?.name);
  document.getElementById('drawer-settings').style.display = currentUser?.role === 'admin' ? 'flex' : 'none';
}

// --- Navigation ---
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item, .drawer-nav a').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  closeDrawer();
  renderTab(tab);
}

async function renderTab(tab) {
  headerTitle.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
  mainEl.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  try {
    switch (tab) {
      case 'dashboard': await renderDashboard(); break;
      case 'visitors': await renderVisitors(); break;
      case 'complaints': await renderComplaints(); break;
      case 'notices': await renderNotices(); break;
      case 'polls': await renderPolls(); break;
      case 'directory': await renderDirectory(); break;
      case 'messages': await renderMessages(); break;
      case 'settings': await renderSettings(); break;
      default: await renderDashboard();
    }
  } catch (e) {
    mainEl.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`;
  }
}

// --- Dashboard ---
async function renderDashboard() {
  const [stats, settings, visitors, notices] = await Promise.all([
    api('/stats'),
    api('/settings'),
    api('/visitors'),
    api('/notices'),
  ]);

  const pendingVisitors = visitors.filter(v => v.status === 'pending').length;
  const myComplaints = (await api('/complaints')).filter(c => c.status !== 'closed').length;

  mainEl.innerHTML = `
    <div class="section">
      <h2 class="section-title">Welcome, ${currentUser.name.split(' ')[0]}</h2>
      <div class="card" style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: #fff; border: none;">
        <div style="font-size: 13px; opacity: .9;">${settings.societyName}</div>
        <div style="font-size: 12px; opacity: .7; margin-top: 4px;">${settings.address}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Quick Stats</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${stats.totalResidents}</div><div class="stat-label">Residents</div></div>
        <div class="stat-card"><div class="stat-value">${pendingVisitors}</div><div class="stat-label">Pending Visitors</div></div>
        <div class="stat-card"><div class="stat-value">${myComplaints}</div><div class="stat-label">My Open Complaints</div></div>
        <div class="stat-card"><div class="stat-value">${stats.activePolls}</div><div class="stat-label">Active Polls</div></div>
      </div>
    </div>

    <div class="section">
      <div class="card-header"><h3 class="card-title">Quick Actions</h3></div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <button class="btn ghost" onclick="setTab('visitors')" style="padding: 20px; flex-direction: column; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span>Visitors</span>
        </button>
        <button class="btn ghost" onclick="setTab('complaints')" style="padding: 20px; flex-direction: column; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Complaints</span>
        </button>
        <button class="btn ghost" onclick="setTab('notices')" style="padding: 20px; flex-direction: column; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
          <span>Notices</span>
        </button>
        <button class="btn ghost" onclick="setTab('polls')" style="padding: 20px; flex-direction: column; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>Polls</span>
        </button>
      </div>
    </div>

    ${notices.length ? `
    <div class="section">
      <div class="card-header"><h3 class="card-title">Latest Notices</h3><a href="#" onclick="setTab('notices')" style="font-size: 13px; font-weight: 600; color: var(--primary);">View all</a></div>
      ${notices.slice(0, 3).map(n => `
        <div class="notice-item ${n.pinned ? 'pinned' : ''} ${n.priority === 'urgent' ? 'notice-priority urgent' : n.priority === 'high' ? 'notice-priority high' : ''}">
          <div class="notice-title">${n.title}${n.pinned ? ' <span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:8px;margin-left:6px;">PINNED</span>' : ''}</div>
          <p class="notice-body">${n.body.slice(0, 100)}${n.body.length > 100 ? '...' : ''}</p>
          <div class="notice-meta">By ${n.authorName} • ${formatDate(n.createdAt)}</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

// --- Visitors ---
async function renderVisitors() {
  const visitors = await api('/visitors');
  if (!visitors.length) {
    mainEl.innerHTML = `
      <div class="section">
        <div class="card-header" style="justify-content: space-between;">
          <h3 class="card-title">My Visitors</h3>
          <button class="btn primary" onclick="openVisitorModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</button>
        </div>
      </div>
      <div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><h3>No visitors yet</h3><p>Add your first visitor entry</p></div>
    `;
    return;
  }

  mainEl.innerHTML = `
    <div class="section">
      <div class="card-header" style="justify-content: space-between;">
        <h3 class="card-title">My Visitors</h3>
        <button class="btn primary" onclick="openVisitorModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</button>
      </div>
      ${visitors.map(v => `
        <div class="visitor-item">
          ${avatarEl(v.visitorName)}
          <div class="visitor-info">
            <div class="visitor-name">${v.visitorName}</div>
            <div class="visitor-meta">
              <span>${v.purpose}</span>
              ${v.vehicleNumber ? `<span>${v.vehicleNumber}</span>` : ''}
              <span>${formatDate(v.expectedArrival)}</span>
            </div>
          </div>
          <span class="visitor-status ${v.status}">${v.status.replace('_', ' ')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function openVisitorModal(v = null) {
  const isEdit = !!v;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Visitor' : 'Add Visitor'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="form-visitor">
          <input type="hidden" name="id" value="${v?.id || ''}">
          <div class="form-group"><label>Visitor Name</label><input type="text" name="visitorName" value="${v?.visitorName || ''}" required></div>
          <div class="form-group"><label>Phone</label><input type="tel" name="visitorPhone" value="${v?.visitorPhone || ''}"></div>
          <div class="form-group"><label>Purpose</label><input type="text" name="purpose" value="${v?.purpose || ''}" required></div>
          <div class="form-group"><label>Vehicle Number</label><input type="text" name="vehicleNumber" value="${v?.vehicleNumber || ''}"></div>
          <div class="form-group"><label>Expected Arrival</label><input type="datetime-local" name="expectedArrival" value="${v?.expectedArrival ? v.expectedArrival.slice(0,16) : new Date().toISOString().slice(0,16)}"></div>
          <div class="form-group"><label>Duration (minutes)</label><input type="number" name="durationMins" value="${v?.durationMins || 120}" min="15" max="1440"></div>
          <div class="form-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn primary">${isEdit ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#form-visitor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.durationMins = parseInt(data.durationMins) || 120;
    delete data.id;
    try {
      if (isEdit) {
        await api(`/visitors/${v.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await api('/visitors', { method: 'POST', body: JSON.stringify(data) });
      }
      toast(isEdit ? 'Visitor updated' : 'Visitor added', 'success');
      modal.remove();
      renderVisitors();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// --- Complaints ---
async function renderComplaints() {
  const complaints = await api('/complaints');
  mainEl.innerHTML = `
    <div class="section">
      <div class="card-header" style="justify-content: space-between;">
        <h3 class="card-title">My Complaints</h3>
        <button class="btn primary" onclick="openComplaintModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</button>
      </div>
      ${complaints.length ? complaints.map(c => `
        <div class="card complaint-item">
          <div class="complaint-header">
            <h4 class="complaint-title">${c.title}</h4>
            <span class="complaint-status ${c.status}">${c.status.replace('_', ' ')}</span>
          </div>
          <div class="complaint-meta">
            <span>${c.category}</span>
            <span>${c.priority}</span>
            <span>${formatDate(c.createdAt)}</span>
          </div>
          <p class="complaint-desc">${c.description}</p>
          ${c.assignedTo ? `<div class="complaint-meta">Assigned to: ${c.assignedTo}</div>` : ''}
        </div>
      `).join('') : `
        <div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><h3>No complaints yet</h3><p>Raise a maintenance request or complaint</p></div>
      `}
    </div>
  `;
}

function openComplaintModal(c = null) {
  const isEdit = !!c;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Complaint' : 'New Complaint'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="form-complaint">
          <input type="hidden" name="id" value="${c?.id || ''}">
          <div class="form-group"><label>Title</label><input type="text" name="title" value="${c?.title || ''}" required></div>
          <div class="form-group"><label>Description</label><textarea name="description" required>${c?.description || ''}</textarea></div>
          <div class="form-group"><label>Category</label>
            <select name="category" required>
              <option value="">Select</option>
              <option value="plumbing" ${c?.category==='plumbing'?'selected':''}>Plumbing</option>
              <option value="electrical" ${c?.category==='electrical'?'selected':''}>Electrical</option>
              <option value="hvac" ${c?.category==='hvac'?'selected':''}>HVAC</option>
              <option value="civil" ${c?.category==='civil'?'selected':''}>Civil/Structural</option>
              <option value="security" ${c?.category==='security'?'selected':''}>Security</option>
              <option value="housekeeping" ${c?.category==='housekeeping'?'selected':''}>Housekeeping</option>
              <option value="other" ${c?.category==='other'?'selected':''}>Other</option>
            </select>
          </div>
          <div class="form-group"><label>Priority</label>
            <select name="priority">
              <option value="low" ${c?.priority==='low'?'selected':''}>Low</option>
              <option value="normal" ${c?.priority==='normal'?'selected':''}>Normal</option>
              <option value="high" ${c?.priority==='high'?'selected':''}>High</option>
              <option value="urgent" ${c?.priority==='urgent'?'selected':''}>Urgent</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn primary">${isEdit ? 'Save' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#form-complaint').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    delete data.id;
    try {
      if (isEdit) await api(`/complaints/${c.id}`, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/complaints', { method: 'POST', body: JSON.stringify(data) });
      toast(isEdit ? 'Complaint updated' : 'Complaint submitted', 'success');
      modal.remove();
      renderComplaints();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// --- Notices ---
async function renderNotices() {
  const notices = await api('/notices');
  mainEl.innerHTML = `
    <div class="section">
      ${currentUser.role === 'admin' ? `
      <div class="card-header" style="justify-content: space-between;">
        <h3 class="card-title">Society Notices</h3>
        <button class="btn primary" onclick="openNoticeModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</button>
      </div>` : `<h3 class="section-title">Society Notices</h3>`}
      ${notices.length ? notices.map(n => `
        <div class="notice-item ${n.pinned ? 'pinned' : ''} ${n.priority === 'urgent' ? 'notice-priority urgent' : n.priority === 'high' ? 'notice-priority high' : ''}">
          <div class="notice-title">${n.title}${n.pinned ? ' <span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:8px;margin-left:6px;">PINNED</span>' : ''}</div>
          <p class="notice-body">${n.body}</p>
          <div class="notice-meta">By ${n.authorName} • ${formatDate(n.createdAt)}</div>
        </div>
      `).join('') : `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/></svg><h3>No notices yet</h3></div>`}
    </div>
  `;
}

function openNoticeModal(n = null) {
  const isEdit = !!n;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Notice' : 'New Notice'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="form-notice">
          <input type="hidden" name="id" value="${n?.id || ''}">
          <div class="form-group"><label>Title</label><input type="text" name="title" value="${n?.title || ''}" required></div>
          <div class="form-group"><label>Body</label><textarea name="body" required>${n?.body || ''}</textarea></div>
          <div class="form-group"><label>Priority</label>
            <select name="priority">
              <option value="normal" ${n?.priority==='normal'?'selected':''}>Normal</option>
              <option value="high" ${n?.priority==='high'?'selected':''}>High</option>
              <option value="urgent" ${n?.priority==='urgent'?'selected':''}>Urgent</option>
            </select>
          </div>
          <div class="form-group"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="pinned" ${n?.pinned?'checked':''}> Pin to top</label></div>
          <div class="form-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn primary">${isEdit ? 'Save' : 'Publish'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#form-notice').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.pinned = !!data.pinned;
    delete data.id;
    try {
      if (isEdit) await api(`/notices/${n.id}`, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/notices', { method: 'POST', body: JSON.stringify(data) });
      toast(isEdit ? 'Notice updated' : 'Notice published', 'success');
      modal.remove();
      renderNotices();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// --- Polls ---
async function renderPolls() {
  const polls = await api('/polls');
  mainEl.innerHTML = `
    <div class="section">
      ${currentUser.role === 'admin' ? `
      <div class="card-header" style="justify-content: space-between;">
        <h3 class="card-title">Polls</h3>
        <button class="btn primary" onclick="openPollModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</button>
      </div>` : `<h3 class="section-title">Polls</h3>`}
      ${polls.length ? polls.map(p => {
        const total = p.options.reduce((s, o) => s + o.votes, 0);
        const votedOpt = p.votes[currentUser.id];
        return `
        <div class="card poll-item">
          <div class="poll-question">${p.question}</div>
          ${p.options.map(o => `
            <div class="poll-option ${votedOpt === o.id ? 'voted' : ''}" style="pointer-events: ${votedOpt ? 'none' : 'auto'};">
              <div style="flex:1;">
                <div class="poll-option-text">${o.text}</div>
                <div class="poll-option-bar"><div class="poll-option-fill" style="width: ${total ? (o.votes/total*100) : 0}%"></div></div>
              </div>
              <span class="poll-option-count">${o.votes}</span>
            </div>
          `).join('')}
          ${votedOpt ? `<div class="poll-voted-badge">You voted</div>` : !p.expiresAt || new Date(p.expiresAt) > new Date() ? `
            <div class="form-actions">
              ${p.options.map(o => `<button class="btn" style="flex:1;" onclick="votePoll('${p.id}','${o.id}')">${o.text}</button>`).join('')}
            </div>` : '<div style="text-align:center;color:var(--text-muted);padding:8px;">Poll expired</div>'}
        </div>
      `).join('') : `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><h3>No active polls</h3></div>`}
    </div>
  `;
}

async function votePoll(pollId, optionId) {
  try {
    await api(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
    toast('Vote recorded', 'success');
    renderPolls();
  } catch (err) { toast(err.message, 'error'); }
}

function openPollModal(p = null) {
  const isEdit = !!p;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Poll' : 'New Poll'}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="form-poll">
          <input type="hidden" name="id" value="${p?.id || ''}">
          <div class="form-group"><label>Question</label><input type="text" name="question" value="${p?.question || ''}" required></div>
          <div class="form-group"><label>Options (one per line, min 2)</label><textarea name="options" rows="4" required>${p?.options?.map(o=>o.text).join('\n') || ''}</textarea></div>
          <div class="form-group"><label>Expires At (optional)</label><input type="datetime-local" name="expiresAt" value="${p?.expiresAt ? p.expiresAt.slice(0,16) : ''}"></div>
          <div class="form-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn primary">${isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#form-poll').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.options = data.options.split('\n').map(s => s.trim()).filter(Boolean);
    if (data.options.length < 2) return toast('At least 2 options required', 'error');
    delete data.id;
    try {
      if (isEdit) await api(`/polls/${p.id}`, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/polls', { method: 'POST', body: JSON.stringify(data) });
      toast(isEdit ? 'Poll updated' : 'Poll created', 'success');
      modal.remove();
      renderPolls();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// --- Directory ---
async function renderDirectory() {
  const users = await api('/directory');
  mainEl.innerHTML = `
    <div class="section">
      <h3 class="section-title">Resident Directory</h3>
      ${users.map(u => `
        <div class="directory-item">
          <div class="directory-avatar">${initials(u.name)}</div>
          <div class="directory-info">
            <div class="directory-name">${u.name}</div>
            <div class="directory-meta">
              <span>${u.apartment}</span>
              ${u.phone ? `<span>${u.phone}</span>` : ''}
              <span>${u.role}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- Messages ---
async function renderMessages() {
  const messages = await api('/messages');
  mainEl.innerHTML = `
    <div class="section">
      <div class="card-header" style="justify-content: space-between;">
        <h3 class="card-title">Messages</h3>
        <button class="btn primary" onclick="openMessageModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</button>
      </div>
      ${messages.length ? messages.map(m => `
        <div class="message-item ${!m.read && m.toUserId === currentUser.id ? 'message-unread' : ''}">
          <div class="message-header">
            <span class="message-from">${m.fromUserName}</span>
            <span class="message-time">${formatDate(m.createdAt)}</span>
          </div>
          ${m.subject ? `<div class="message-subject">${m.subject}</div>` : ''}
          <div class="message-body">${m.body}</div>
        </div>
      `).join('') : `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>No messages</h3></div>`}
    </div>
  `;
}

function openMessageModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">New Message</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body">
        <form id="form-message">
          <div class="form-group"><label>To (apartment or name)</label><input type="text" name="toQuery" id="toQuery" required placeholder="Type name or apartment..."><div id="toResults" style="position:absolute;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:4px;width:calc(100% - 24px);max-height:150px;overflow:auto;display:none;z-index:10;"></div></div>
          <input type="hidden" name="toUserId" id="toUserId">
          <div class="form-group"><label>Subject</label><input type="text" name="subject"></div>
          <div class="form-group"><label>Message</label><textarea name="body" required></textarea></div>
          <div class="form-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn primary">Send</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const toQuery = modal.querySelector('#toQuery');
  const toResults = modal.querySelector('#toResults');
  const toUserId = modal.querySelector('#toUserId');
  let usersCache = [];

  async function loadUsers() { usersCache = await api('/directory'); }
  loadUsers();

  toQuery.addEventListener('input', () => {
    const q = toQuery.value.toLowerCase();
    const matches = usersCache.filter(u => u.name.toLowerCase().includes(q) || u.apartment.toLowerCase().includes(q)).slice(0, 8);
    if (matches.length && q) {
      toResults.innerHTML = matches.map(u => `<div style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);" data-id="${u.id}">${u.name} <span style="color:var(--text-muted);">(${u.apartment})</span></div>`).join('');
      toResults.style.display = 'block';
    } else { toResults.style.display = 'none'; }
  });

  toResults.addEventListener('click', (e) => {
    const el = e.target.closest('[data-id]');
    if (el) { toQuery.value = el.textContent.trim(); toUserId.value = el.dataset.id; toResults.style.display = 'none'; }
  });

  document.addEventListener('click', (e) => { if (!modal.contains(e.target)) toResults.style.display = 'none'; }, { once: true });

  modal.querySelector('#form-message').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    if (!data.toUserId) return toast('Select a recipient', 'error');
    try {
      await api('/messages', { method: 'POST', body: JSON.stringify(data) });
      toast('Message sent', 'success');
      modal.remove();
      renderMessages();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// --- Settings ---
async function renderSettings() {
  const settings = await api('/settings');
  const isAdmin = currentUser.role === 'admin';

  mainEl.innerHTML = `
    <div class="section">
      <h3 class="section-title">Account</h3>
      <div class="card">
        <div class="settings-item">
          <div class="settings-info"><h4>Name</h4><p>${currentUser.name}</p></div>
        </div>
        <div class="settings-item">
          <div class="settings-info"><h4>Email</h4><p>${currentUser.email}</p></div>
        </div>
        <div class="settings-item">
          <div class="settings-info"><h4>Apartment</h4><p>${currentUser.apartment}</p></div>
        </div>
        <div class="settings-item">
          <div class="settings-info"><h4>Role</h4><p>${currentUser.role}</p></div>
        </div>
      </div>
    </div>

    ${isAdmin ? `
    <div class="section">
      <h3 class="section-title">Society Settings</h3>
      <div class="card">
        <form id="form-settings">
          <div class="form-group"><label>Society Name</label><input type="text" name="societyName" value="${settings.societyName}"></div>
          <div class="form-group"><label>Address</label><textarea name="address">${settings.address}</textarea></div>
          <div class="form-group"><label>Contact Email</label><input type="email" name="contactEmail" value="${settings.contactEmail}"></div>
          <div class="form-group"><label>Contact Phone</label><input type="tel" name="contactPhone" value="${settings.contactPhone}"></div>
          <div class="form-group"><label>Gate Hours</label><input type="text" name="gateHours" value="${settings.gateHours}"></div>
          <div class="form-group"><label>Maintenance Phone</label><input type="tel" name="maintenancePhone" value="${settings.maintenancePhone}"></div>
          <div class="form-actions"><button type="submit" class="btn primary">Save Settings</button></div>
        </form>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="card">
        <button class="btn danger" onclick="logout()" style="width:100%;">Sign Out</button>
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('form-settings').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      try {
        await api('/settings', { method: 'PUT', body: JSON.stringify(data) });
        toast('Settings saved', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

// --- Init ---
async function init() {
  // Auth forms
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { await login(fd.get('email'), fd.get('password')); toast('Welcome back!', 'success'); enterApp(); }
    catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try { await register(data); toast('Account created!', 'success'); enterApp(); }
    catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-show-register').onclick = () => showScreen('register');
  document.getElementById('btn-show-login').onclick = () => showScreen('login');

  // Drawer
  document.getElementById('btn-menu').onclick = openDrawer;
  document.getElementById('btn-close-drawer').onclick = closeDrawer;
  drawerOverlay.onclick = closeDrawer;
  document.querySelectorAll('.drawer-nav a').forEach(a => a.onclick = (e) => { e.preventDefault(); setTab(a.dataset.tab); });

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(a => a.onclick = (e) => { e.preventDefault(); setTab(a.dataset.tab); });

  // Logout
  document.getElementById('btn-logout').onclick = logout;

  // Check auth
  if (await checkAuth()) enterApp();
}

function enterApp() {
  showScreen('app');
  bottomNav.hidden = false;
  updateDrawer();
  setTab('dashboard');
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Expose for inline onclick
window.setTab = setTab;
window.openVisitorModal = openVisitorModal;
window.openComplaintModal = openComplaintModal;
window.openNoticeModal = openNoticeModal;
window.openPollModal = openPollModal;
window.openMessageModal = openMessageModal;
window.votePoll = votePoll;
window.logout = logout;

init();