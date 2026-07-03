/* ==========================================================================
   AUTH.JS — Login e controle de acesso por papel (admin / diretor).

   Aviso: este é um site 100% estático (sem servidor). O controle de acesso
   aqui é organizacional (evita que o diretor veja/edite o que não deve),
   NÃO é uma proteção de segurança real — qualquer pessoa com acesso ao
   código-fonte da página consegue ver as senhas em config.js.
   ========================================================================== */

const SESSION_KEY = 'docg_session';
const OVERRIDE_KEY = 'docg_access_override';
const ALL_VIEWS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'dre', label: 'DRE Projetada' },
  { id: 'premissas', label: 'Premissas' },
];

let CURRENT_USER = null;

function getEffectiveConfig() {
  // Admin's live preview (this browser only) overrides config.js defaults until published.
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (raw) {
      const override = JSON.parse(raw);
      return {
        directorVisibleViews: override.views || window.APP_CONFIG.directorVisibleViews,
        directorPermissions: override.permissions || window.APP_CONFIG.directorPermissions,
      };
    }
  } catch (e) { /* ignore malformed override */ }
  return {
    directorVisibleViews: window.APP_CONFIG.directorVisibleViews,
    directorPermissions: window.APP_CONFIG.directorPermissions,
  };
}

function saveSession(user, remember) {
  const payload = JSON.stringify(user);
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
  }
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

function attemptLogin(username, password) {
  const users = window.APP_CONFIG.users;
  const key = Object.keys(users).find(u => u.toLowerCase() === username.trim().toLowerCase());
  if (!key || users[key].password !== password) {
    return null;
  }
  return { username: key, role: users[key].role, name: users[key].name };
}

function applyRoleRestrictions(user) {
  const isAdmin = user.role === 'admin';
  const cfg = getEffectiveConfig();

  // user chip
  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userRole').textContent = isAdmin ? 'Administrador' : 'Diretor · somente leitura';

  // admin-only nav item
  document.getElementById('navAccessItem').style.display = isAdmin ? '' : 'none';

  // filter sidebar nav for diretor
  const visibleSet = isAdmin ? ALL_VIEWS.map(v => v.id) : cfg.directorVisibleViews;
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    const view = btn.dataset.view;
    if (view === 'access') return; // handled above
    const li = btn.closest('li');
    li.style.display = visibleSet.includes(view) ? '' : 'none';
  });

  // land on the first visible view
  const firstVisibleBtn = document.querySelector('.nav-item[data-view]:not([style*="display: none"])') ||
    Array.from(document.querySelectorAll('.nav-item[data-view]')).find(b => visibleSet.includes(b.dataset.view));
  if (firstVisibleBtn) firstVisibleBtn.click();

  // controls panel + scenario switch + company filter permissions (diretor only)
  const controlsWrap = document.querySelector('.controls-wrap');
  const scenarioSwitch = document.getElementById('scenarioSwitch');
  const companySelect = document.getElementById('companySelect');
  if (isAdmin) {
    controlsWrap.style.display = '';
    scenarioSwitch.style.display = '';
    companySelect.disabled = false;
  } else {
    controlsWrap.style.display = cfg.directorPermissions.canEditAssumptions ? '' : 'none';
    scenarioSwitch.style.display = cfg.directorPermissions.canChangeScenario ? '' : 'none';
    companySelect.disabled = !cfg.directorPermissions.canChangeCompany;
  }

  if (isAdmin) initAccessControlPanel();
}

function initAccessControlPanel() {
  const cfg = getEffectiveConfig();
  const grid = document.getElementById('accessViewsGrid');
  grid.innerHTML = ALL_VIEWS.map(v => `
    <label class="access-toggle">
      <input type="checkbox" data-view-id="${v.id}" ${cfg.directorVisibleViews.includes(v.id) ? 'checked' : ''}>
      <span>${v.label}</span>
    </label>`).join('');

  document.getElementById('permScenario').checked = !!cfg.directorPermissions.canChangeScenario;
  document.getElementById('permAssumptions').checked = !!cfg.directorPermissions.canEditAssumptions;
  document.getElementById('permCompany').checked = !!cfg.directorPermissions.canChangeCompany;

  function currentSelection() {
    const views = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.dataset.viewId);
    const permissions = {
      canChangeScenario: document.getElementById('permScenario').checked,
      canEditAssumptions: document.getElementById('permAssumptions').checked,
      canChangeCompany: document.getElementById('permCompany').checked,
    };
    return { views, permissions };
  }

  function updatePreview() {
    const sel = currentSelection();
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(sel));
    const snippet =
`directorVisibleViews: [${sel.views.map(v => `"${v}"`).join(', ')}],
directorPermissions: {
  canChangeScenario: ${sel.permissions.canChangeScenario},
  canEditAssumptions: ${sel.permissions.canEditAssumptions},
  canChangeCompany: ${sel.permissions.canChangeCompany},
},`;
    document.getElementById('configPreview').textContent = snippet;
  }

  grid.querySelectorAll('input').forEach(cb => cb.addEventListener('change', updatePreview));
  document.getElementById('permScenario').addEventListener('change', updatePreview);
  document.getElementById('permAssumptions').addEventListener('change', updatePreview);
  document.getElementById('permCompany').addEventListener('change', updatePreview);
  updatePreview();

  document.getElementById('copyConfigBtn').onclick = () => {
    const text = document.getElementById('configPreview').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const fb = document.getElementById('copyFeedback');
      fb.textContent = 'Copiado! Cole em config.js e publique novamente.';
      setTimeout(() => { fb.textContent = ''; }, 3500);
    });
  };
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
    login(existing, true);
  } else {
    showLogin();
  }

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const remember = document.getElementById('loginRemember').checked;
    const user = attemptLogin(username, password);
    if (!user) {
      showLogin('Usuário ou senha incorretos.');
      return;
    }
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
