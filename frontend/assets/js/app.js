/**
 * App shell: navigation rendering, loading screen, ripple effect,
 * modal helpers and small shared utilities used across every page.
 */
const NAV_ITEMS = [
  { id: 'dashboard', href: 'dashboard.html', label: 'Home', icon: 'icon-home' },
  { id: 'attendance', href: 'attendance.html', label: 'Attendance', icon: 'icon-calendar' },
  { id: 'homework', href: 'homework.html', label: 'Homework', icon: 'icon-book' },
  { id: 'schedule', href: 'schedule.html', label: 'Schedule', icon: 'icon-clock' },
  { id: 'more', href: 'more.html', label: 'More', icon: 'icon-more' }
];

const App = {
  /** Call at the top of every authenticated page. Redirects to login if needed. */
  guard({ adminOnly = false } = {}) {
    if (!Auth.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    if (adminOnly && !Auth.isAdmin()) {
      window.location.href = '403.html';
      return false;
    }
    return true;
  },

  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  },

  avatarHtml(user, size = 'md') {
    if (user && user.avatar) {
      return `<span class="avatar avatar--${size}"><img src="${Api.fileUrl(user.avatar)}" alt="${user.fullName}"></span>`;
    }
    return `<span class="avatar avatar--${size}">${this.initials(user?.fullName)}</span>`;
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  },

  formatDate(dateStr, opts) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });
  },

  formatDateLong(dateStr) {
    return this.formatDate(dateStr, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  },

  formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  },

  formatTime12(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  },

  timeUntil(iso) {
    const diff = new Date(iso) - new Date();
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    if (days === 0 && hours === 0) return diff < 0 ? 'Just passed' : 'Due soon';
    const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    return diff < 0 ? `${label} overdue` : `Due in ${label}`;
  },

  debounce(fn, wait = 350) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  },

  hideLoadingScreen() {
    const el = document.getElementById('loading-screen');
    if (el) setTimeout(() => el.classList.add('is-hidden'), 280);
  },

  /** Renders the top bar (brand + page actions slot) and bottom/side nav. */
  async renderShell(activeId) {
    const topRoot = document.getElementById('topbar-root');
    const navRoot = document.getElementById('tabbar-root');
    const user = Auth.getUser();

    let settings = { schoolName: 'Class Management', logo: '' };
    try {
      const res = await Api.request('/admin/settings', { silent: true });
      settings = res.settings;
      window.__settings = settings;
    } catch (e) { /* keep defaults if offline */ }

    if (topRoot) {
      topRoot.innerHTML = `
        <div class="topbar__brand">
          <span class="topbar__logo">${settings.logo ? `<img src="${Api.fileUrl(settings.logo)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : '<svg class="icon-sm"><use href="assets/svg/icons.svg#icon-sparkle"></use></svg>'}</span>
          <span class="truncate" style="max-width:150px">${this.escapeHtml(settings.schoolName)}</span>
        </div>
        <div class="topbar__actions">
          <a class="icon-btn" href="announcement.html" aria-label="Announcements"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-bell"></use></svg></a>
          <a class="icon-btn" href="profile.html" aria-label="Profile">${this.avatarHtml(user, 'sm')}</a>
        </div>`;
    }

    if (navRoot) {
      const items = NAV_ITEMS.map((item) => `
        <a class="tab ${item.id === activeId ? 'is-active' : ''}" href="${item.href}">
          <svg><use href="assets/svg/icons.svg#${item.icon}"></use></svg>
          <span>${item.label}</span>
        </a>`).join('');
      navRoot.innerHTML = `<nav class="tabbar"><div class="tabbar__inner">${items}</div></nav>`;
    }
  },

  /** Simple modal open/close using the .modal-overlay / .modal-sheet pattern. */
  openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  },
  closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  },

  bindModalDismiss() {
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
      overlay.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => this.closeModal(overlay.id));
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.is-open').forEach((o) => this.closeModal(o.id));
      }
    });
  },

  /** Delegated ripple effect for any element with the .btn class. */
  bindRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  },

  bindOfflineDetection() {
    window.addEventListener('offline', () => {
      if (!location.pathname.endsWith('offline.html')) {
        Toast.warning("You're offline. Some features may not work.");
      }
    });
  },

  skeletonCards(n = 3, height = 88) {
    return Array.from({ length: n })
      .map(() => `<div class="skeleton sk-card" style="height:${height}px"></div>`)
      .join('');
  },

  emptyState(icon, title, msg) {
    return `
      <div class="empty-state">
        <span class="empty-state__icon"><svg><use href="assets/svg/icons.svg#${icon}"></use></svg></span>
        <h4>${title}</h4>
        <p>${msg}</p>
      </div>`;
  },

  statusMeta(status) {
    const map = {
      present: { label: 'Present', icon: 'icon-check', color: 'var(--status-present)' },
      late: { label: 'Late', icon: 'icon-clock', color: 'var(--status-late)' },
      permission: { label: 'Permission', icon: 'icon-flag', color: 'var(--status-permission)' },
      sick: { label: 'Sick', icon: 'icon-alert', color: 'var(--status-sick)' },
      absent: { label: 'Absent', icon: 'icon-x', color: 'var(--status-absent)' }
    };
    return map[status] || { label: status, icon: 'icon-info', color: 'var(--ink-300)' };
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.bindRipple();
  App.bindOfflineDetection();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching is a nice-to-have, never block the app */ });
  });
}
