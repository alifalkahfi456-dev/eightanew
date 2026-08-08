/**
 * Handles the login.html and register.html forms.
 * Included on both pages; each page's markup determines which init runs.
 */
function togglePasswordField(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = `<svg class="icon-sm"><use href="assets/svg/icons.svg#${isHidden ? 'icon-eye-off' : 'icon-eye'}"></use></svg>`;
}

function setFieldError(fieldEl, message) {
  const errorEl = fieldEl.querySelector('.field-error');
  if (message) {
    fieldEl.classList.add('has-error');
    if (errorEl) errorEl.textContent = message;
  } else {
    fieldEl.classList.remove('has-error');
  }
}

function setButtonLoading(btn, loading, loadingText = 'Please wait…') {
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="icon-sm" style="animation:spin 0.8s linear infinite"><use href="assets/svg/icons.svg#icon-refresh"></use></svg> ${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }
}

// Small inline keyframe for the spinner icon used above.
(function injectSpinKeyframe() {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();

function initLoginPage() {
  if (Auth.isLoggedIn()) {
    window.location.href = Auth.isAdmin() ? 'admin.html' : 'dashboard.html';
    return;
  }
  App.hideLoadingScreen();

  const form = document.getElementById('login-form');
  const nameField = document.getElementById('field-name');
  const passField = document.getElementById('field-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldError(nameField, null);
    setFieldError(passField, null);

    const fullName = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;

    if (!fullName) return setFieldError(nameField, 'Please enter your full name.');
    if (!password) return setFieldError(passField, 'Please enter your password.');

    const btn = document.getElementById('login-submit');
    setButtonLoading(btn, true, 'Signing in…');
    try {
      const res = await Api.post('/auth/login', { fullName, password, remember });
      Auth.setToken(res.token, remember);
      Auth.setUser(res.user);
      Toast.success(res.message || 'Welcome back!');
      setTimeout(() => {
        window.location.href = res.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }, 350);
    } catch (err) {
      Toast.error(err.message);
      setButtonLoading(btn, false);
    }
  });
}

function initRegisterPage() {
  if (Auth.isLoggedIn()) {
    window.location.href = Auth.isAdmin() ? 'admin.html' : 'dashboard.html';
    return;
  }
  App.hideLoadingScreen();

  const form = document.getElementById('register-form');
  const nameField = document.getElementById('field-name');
  const passField = document.getElementById('field-password');
  const confirmField = document.getElementById('field-confirm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    [nameField, passField, confirmField].forEach((f) => setFieldError(f, null));

    const fullName = document.getElementById('register-name').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;

    let hasError = false;
    if (fullName.length < 2) { setFieldError(nameField, 'Please enter your full name.'); hasError = true; }
    if (password.length < 6) { setFieldError(passField, 'Password must be at least 6 characters.'); hasError = true; }
    if (password !== confirmPassword) { setFieldError(confirmField, 'Passwords do not match.'); hasError = true; }
    if (hasError) return;

    const btn = document.getElementById('register-submit');
    setButtonLoading(btn, true, 'Creating account…');
    try {
      const res = await Api.post('/auth/register', { fullName, password, confirmPassword });
      Auth.setToken(res.token, true);
      Auth.setUser(res.user);
      Toast.success('Account created! Welcome aboard.');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 350);
    } catch (err) {
      Toast.error(err.message);
      setButtonLoading(btn, false);
    }
  });
}
