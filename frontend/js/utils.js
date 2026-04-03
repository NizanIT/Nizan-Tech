// ─── CONFIG ───────────────────────────────────────────────
const API_BASE = 'https://nizan-tech.onrender.com/api';

const escHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
};

// ─── API HELPER ───────────────────────────────────────────
const api = {
  async request(method, endpoint, body = null) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, opts);
      const data = await res.json();
      
      if (!res.ok) {
        // Handle Session Expired
        if (res.status === 401 || res.status === 403) {
          // Only redirect if NOT already on the login page to avoid loops
          const isLoginPage = window.location.pathname === '/' || window.location.pathname.includes('index.html');
          if (!isLoginPage) {
            toast.error('Session expired. Redirecting to login...');
            setTimeout(() => window.location.href = '/index.html', 1500);
          }
          return null;
        }
        
        // Handle Render Sleep
        if (res.status === 503 || res.status === 502) {
          toast.info('The server is waking up. Please wait 30 seconds and try again.');
          throw new Error('Server is currently starting up.');
        }

        throw new Error(data.message || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error(`❌ API Error [${method} ${endpoint}]:`, err.message);
      
      // Specifically handle the "Unexpected token" error for better user feedback
      if (err.message.includes('Unexpected token')) {
        toast.error('The server response was invalid. It might still be waking up. Please wait 30 seconds.');
      } else if (err.message === 'Failed to fetch') {
        toast.error('Network Error: Please check your internet or if the server is live.');
      } else {
        toast.error(err.message);
      }
      throw err;
    }
  },
  get: (ep) => api.request('GET', ep),
  post: (ep, body) => api.request('POST', ep, body),
  put: (ep, body) => api.request('PUT', ep, body),
  del: (ep) => api.request('DELETE', ep),
};

// ─── TIME HELPERS ─────────────────────────────────────────
const time = {
  toMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  },
  formatDuration(startTime, endTime) {
    const mins = this.toMinutes(endTime) - this.toMinutes(startTime);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },
  to12h(t24) {
    const [h, m] = t24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  },
  totalHoursFromBlocks(blocks) {
    const mins = blocks.reduce((acc, b) => {
      return acc + this.toMinutes(b.endTime) - this.toMinutes(b.startTime);
    }, 0);
    return (mins / 60).toFixed(1);
  }
};

// ─── DATE HELPERS ─────────────────────────────────────────
const dateUtils = {
  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  formatShort(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  isToday(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  },
  isPast(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  },
  isFuture(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today;
  },
  getDayName(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  },
  timeAgo(dateStr) {
    const ms = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return dateUtils.formatShort(dateStr);
  }
};

// ─── TOAST NOTIFICATIONS ──────────────────────────────────
const toast = (() => {
  let container = null;
  const getContainer = () => {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const show = (message, type = 'info', duration = 3500) => {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    getContainer().appendChild(el);
    setTimeout(() => el.remove(), duration);
  };
  return { success: (m) => show(m, 'success'), error: (m) => show(m, 'error'), info: (m) => show(m, 'info') };
})();

// ─── MODAL HELPERS ────────────────────────────────────────
const modal = {
  open(id) { document.getElementById(id)?.classList.add('active'); },
  close(id) { document.getElementById(id)?.classList.remove('active'); },
  closeAll() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
};

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) modal.closeAll();
});

// ─── AVATAR ───────────────────────────────────────────────
const getInitials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const renderAvatar = (name, color, size = '') => `
  <div class="avatar ${size}" style="background:${color || '#6C63FF'}">${getInitials(name)}</div>
`;

// ─── SIDEBAR HELPER ───────────────────────────────────────
const initSidebar = (activeNav) => {
  // Mark active nav
  document.querySelectorAll('.nav-item[data-nav]').forEach(el => {
    if (el.dataset.nav === activeNav) el.classList.add('active');
  });

  // Mobile hamburger
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  hamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('show');
  });
  backdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
  });
};

// ─── THEME ────────────────────────────────────────────────
const initTheme = () => {
  const stored = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', stored);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
};

// ─── AUTH GUARD ───────────────────────────────────────────
const requireAuth = async (expectedRole) => {
  try {
    const res = await api.get('/auth/me');
    const user = res.user;
    if (expectedRole && user.role !== expectedRole) {
      window.location.href = user.role === 'admin' ? '/admin/dashboard.html' : '/employee/dashboard.html';
      return null;
    }
    return user;
  } catch {
    window.location.href = '/index.html';
    return null;
  }
};

// ─── SET USER IN SIDEBAR ──────────────────────────────────
const setSidebarUser = (user) => {
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) {
    roleEl.textContent = user.role;
    roleEl.className = `sidebar-user-role role-${user.role}`;
  }
  if (avatarEl) {
    avatarEl.style.background = user.avatarColor || '#6C63FF';
    avatarEl.textContent = getInitials(user.name);
  }
};

// ─── LOGOUT ───────────────────────────────────────────────
const logout = async () => {
  await api.post('/auth/logout');
  window.location.replace('/index.html');
};

document.getElementById('logoutBtn')?.addEventListener('click', logout);
