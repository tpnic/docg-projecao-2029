/* ==========================================================================
   AUTH.JS — Login e controle de acesso por usuario.

   Aviso: este e um site 100% estatico (sem servidor). O controle de acesso
   aqui e organizacional (evita que cada pessoa veja/edite o que nao deve),
   NAO e uma protecao de seguranca real — qualquer pessoa com acesso ao
   codigo-fonte da pagina consegue ver as senhas em config.js.
   ========================================================================== */

const SESSION_KEY = 'docg_session';
const USERS_OVERRIDE_KEY = 'docg_users_override';
const ALL_VIEWS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'dre', label: 'DRE Projetada' },
  { id: 'premissas', label: 'Premissas' },
];

let CURRENT_USER = null;

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore malformed override */ }
  return window.APP_CONFIG.users;
}

function saveSession(user, remember) {
  const payload = JSON.stringify({ username: user.username });
  if (remember) localStorage.setItem(SESSION_KEY, payload);
  else sessionStorage.setItem(SESSION_KEY, payload);
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function showLogin(message) {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
  const err = document.getElementById('loginError');
  err.textContent = message || '';
  err.style.display = message ? 'block' : 'none';
}

function hideLogin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'grid';
}

function findUser(username) {
  const users = getUsers();
  return users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
}

function attemptLogin(username, password) {
  const user = findUser(username);
  if (!user || user.password !== password) return null;
  return user;
}

function userVisibleViews(user) {
  if (user.role === 'admin') return ALL_VIEWS.map(v => v.id);
  return user.views || [];
}
function userPermissions(user) {
  if (user.role === 'admin') return { canChangeScenario: true, canEditAssumptions: true, canChangeCompany: true };
  return user.permissions || { canChangeScenario: false, canEditAssumptions: false, canChangeCompany: false };
}

function applyRoleRestrictions(user) {
  const isAdmin = user.role === 'admin';
  const visibleSet = userVisibleViews(user);
  const perms = userPermissions(user);

  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userRole').textContent = isAdmin ? 'Administrador' : (user.name + ' · acesso restrito');

  document.getElementById('navAccessItem').style.display = isAdmin ? '' : 'none';

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    const view = btn.dataset.view;
    if (view === 'access') return;
    const li = btn.closest('li');
    li.style.display = visibleSet.includes(view) ? '' : 'none';
  });

  const firstVisibleBtn = Array.from(document.querySelectorAll('.nav-item[data-view]'))
    .find(b => b.dataset.view === 'access' ? false : visibleSet.includes(b.dataset.view));
  if (firstVisibleBtn) firstVisibleBtn.click();

  const drawerToggle = document.getElementById('drawerToggleBtn');
  const scenarioSwitch = document.getElementById('scenarioSwitch');
  const companySelect = document.getElementById('companySelect');

  drawerToggle.style.display = perms.canEditAssumptions ? '' : 'none';
  scenarioSwitch.style.display = perms.canChangeScenario ? '' : 'none';
  companySelect.disabled = !perms.canChangeCompany;

  if (isAdmin) initUserManagementPanel();
}

/* ------------------------------ User management (admin) ------------------------------ */
function renderUsersList() {
  const users = getUsers().filter(u => u.role !== 'admin');
  const wrap = document.getElementById('usersListWrap');
  if (users.length === 0) {
    wrap.innerHTML = `<p class="footnote">Nenhum usuário personalizado criado ainda.</p>`;
    return;
  }
  wrap.innerHTML = users.map((u, i) => {
    const views = (u.views || []).map(v => ALL_VIEWS.find(av => av.id === v)?.label || v).join(', ') || 'nenhuma';
    const perms = u.permissions || {};
    const permsList = [
      perms.canChangeScenario ? 'troca cenário' : null,
      perms.canEditAssumptions ? 'edita premissas' : null,
      perms.canChangeCompany ? 'troca empresa' : null,
    ].filter(Boolean).join(', ') || 'somente visualização';
    return `
      <div class="user-row">
        <div class="user-row-avatar">${u.name.charAt(0).toUpperCase()}</div>
        <div class="user-row-info">
          <div class="user-row-name">${u.name} <span class="user-row-username">@${u.username}</span></div>
          <div class="user-row-meta">Telas: ${views} · Permissões: ${permsList}</div>
        </div>
        <button class="user-row-delete" data-idx="${i}" title="Remover usuário">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>
        </button>
      </div>`;
  }).join('');

  wrap.querySelectorAll('.user-row-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const allUsers = getUsers();
      const customUsers = allUsers.filter(u => u.role !== 'admin');
      const toRemove = customUsers[idx];
      const updated = allUsers.filter(u => u !== toRemove);
      localStorage.setItem(USERS_OVERRIDE_KEY, JSON.stringify(updated));
      renderUsersList();
      updateConfigPreview();
    });
  });
}

function initUserManagementPanel() {
  const viewsGrid = document.getElementById('newUserViewsGrid');
  viewsGrid.innerHTML = ALL_VIEWS.map(v => `
    <label class="access-toggle">
      <input type="checkbox" data-view-id="${v.id}">
      <span>${v.label}</span>
    </label>`).join('');

  renderUsersList();
  updateConfigPreview();

  document.getElementById('addUserBtn').addEventListener('click', () => {
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newUserName').value.trim() || username;
    const errEl = document.getElementById('newUserError');
    errEl.textContent = '';

    if (!username || !password) { errEl.textContent = 'Preencha usuário e senha.'; return; }
    if (findUser(username)) { errEl.textContent = 'Já existe um usuário com esse nome.'; return; }

    const views = Array.from(viewsGrid.querySelectorAll('input:checked')).map(i => i.dataset.viewId);
    const permissions = {
      canChangeScenario: document.getElementById('newUserPermScenario').checked,
      canEditAssumptions: document.getElementById('newUserPermAssumptions').checked,
      canChangeCompany: document.getElementById('newUserPermCompany').checked,
    };
    const newUser = { username, password, role: 'custom', name, views, permissions };
    const updated = [...getUsers(), newUser];
    localStorage.setItem(USERS_OVERRIDE_KEY, JSON.stringify(updated));

    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserName').value = '';
    viewsGrid.querySelectorAll('input').forEach(i => i.checked = false);
    ['newUserPermScenario', 'newUserPermAssumptions', 'newUserPermCompany'].forEach(id => document.getElementById(id).checked = false);

    renderUsersList();
    updateConfigPreview();
  });

  document.getElementById('copyConfigBtn').addEventListener('click', () => {
    const text = document.getElementById('configPreview').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const fb = document.getElementById('copyFeedback');
      fb.textContent = 'Copiado! Cole em config.js (substituindo o array "users") e publique novamente.';
      setTimeout(() => { fb.textContent = ''; }, 4500);
    });
  });
}

function updateConfigPreview() {
  const users = getUsers();
  const lines = users.map(u => {
    if (u.role === 'admin') {
      return `    { username: "${u.username}", password: "${u.password}", role: "admin", name: "${u.name}" },`;
    }
    const views = (u.views || []).map(v => `"${v}"`).join(', ');
    const p = u.permissions || {};
    return `    {
      username: "${u.username}",
      password: "${u.password}",
      role: "custom",
      name: "${u.name}",
      views: [${views}],
      permissions: {
        canChangeScenario: ${!!p.canChangeScenario},
        canEditAssumptions: ${!!p.canEditAssumptions},
        canChangeCompany: ${!!p.canChangeCompany},
      },
    },`;
  });
  document.getElementById('configPreview').textContent = `window.APP_CONFIG = {\n  users: [\n${lines.join('\n')}\n  ],\n};`;
}

function login(user, remember) {
  CURRENT_USER = user;
  window.CURRENT_USER = user;
  saveSession(user, remember);
  hideLogin();
  if (window.__dashboardStarted) {
    applyRoleRestrictions(user);
  } else {
    window.__dashboardStarted = true;
    window.startDashboard().then(() => applyRoleRestrictions(user));
  }
}

function initAuth() {
  const existing = loadSession();
  if (existing) {
    const user = findUser(existing.username);
    if (user) { login(user, true); return; }
  }
  showLogin();

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const remember = document.getElementById('loginRemember').checked;
    const user = attemptLogin(username, password);
    if (!user) { showLogin('Usuário ou senha incorretos.'); return; }
    login(user, remember);
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    CURRENT_USER = null;
    window.CURRENT_USER = null;
    document.getElementById('loginForm').reset();
    showLogin();
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
