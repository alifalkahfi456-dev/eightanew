/**
 * Thin fetch wrapper around the backend API.
 * Handles auth headers, JSON parsing, and consistent error objects.
 */
const Auth = {
  TOKEN_KEY: 'cms_token',
  USER_KEY: 'cms_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
  },
  setToken(token, remember) {
    this.clearToken();
    (remember ? localStorage : sessionStorage).setItem(this.TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser(user) {
    const store = localStorage.getItem(this.TOKEN_KEY) ? localStorage : sessionStorage;
    store.setItem(this.USER_KEY, JSON.stringify(user));
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  isAdmin() {
    const u = this.getUser();
    return !!u && u.role === 'admin';
  },
  logout() {
    this.clearToken();
    window.location.href = 'login.html';
  }
};

const Api = {
  async request(path, { method = 'GET', body, isForm = false, silent = false } = {}) {
    const headers = {};
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isForm) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(`${window.APP_CONFIG.apiBaseUrl}${path}`, {
        method,
        headers,
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined
      });
    } catch (networkErr) {
      const err = new Error('Cannot reach the server. Check your connection and try again.');
      err.isNetwork = true;
      throw err;
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (response.status === 401 && !silent) {
      Auth.clearToken();
      if (!location.pathname.endsWith('login.html') && !location.pathname.endsWith('register.html')) {
        window.location.href = 'login.html';
      }
    }

    if (!response.ok || !data || data.success === false) {
      const message = (data && data.message) || `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(path) { return this.request(path, { method: 'GET' }); },
  post(path, body, opts = {}) { return this.request(path, { method: 'POST', body, ...opts }); },
  put(path, body, opts = {}) { return this.request(path, { method: 'PUT', body, ...opts }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },

  fileUrl(relativePath) {
    if (!relativePath) return '';
    if (relativePath.startsWith('http')) return relativePath;
    const base = window.APP_CONFIG.apiBaseUrl.replace(/\/api\/?$/, '');
    return `${base}${relativePath}`;
  }
};
