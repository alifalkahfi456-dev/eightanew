(async function () {
  if (!App.guard()) return;
  await App.renderShell('more');

  const user = Auth.getUser();
  renderProfileHeader(user);
  await loadProfileStats();
  App.hideLoadingScreen();

  document.getElementById('avatar-input').addEventListener('change', handleAvatarUpload);
  document.getElementById('name-form').addEventListener('submit', submitNameForm);
  document.getElementById('password-form').addEventListener('submit', submitPasswordForm);
  document.getElementById('profile-logout').addEventListener('click', () => {
    if (confirm('Log out of your account?')) Auth.logout();
  });
})();

function renderProfileHeader(user) {
  document.getElementById('profile-avatar').innerHTML = App.avatarHtml(user, 'xl');
  document.getElementById('profile-name').textContent = user.fullName;
  document.getElementById('profile-role').textContent = user.role === 'admin' ? 'Administrator' : 'Student';
  document.getElementById('profile-name-input').value = user.fullName;
}

async function loadProfileStats() {
  const row = document.getElementById('profile-stats');
  try {
    const [{ stats }, hwRes] = await Promise.all([
      Api.get('/attendance/stats/me'),
      Api.get('/homework?limit=200')
    ]);
    const homework = hwRes.data;
    const completed = homework.filter((h) => h.completed).length;

    const tiles = [
      { label: 'Attendance Rate', value: `${stats.rate}%`, color: 'var(--blue-600)' },
      { label: 'Present Days', value: stats.present, color: 'var(--status-present)' },
      { label: 'Homework Done', value: `${completed}/${homework.length}`, color: 'var(--success)' }
    ];
    row.innerHTML = tiles.map((t) => `
      <div class="glass tile" style="min-width:130px">
        <span class="tile__value" style="color:${t.color}; font-size:20px">${t.value}</span>
        <span class="tile__label">${t.label}</span>
      </div>`).join('');
  } catch (err) {
    row.innerHTML = '';
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const form = new FormData();
    form.append('avatar', file);
    const res = await Api.post('/auth/avatar', form, { isForm: true });
    const user = Auth.getUser();
    user.avatar = res.avatar;
    Auth.setUser(user);
    renderProfileHeader(user);
    Toast.success('Profile picture updated.');
  } catch (err) {
    Toast.error(err.message);
  }
}

async function submitNameForm(e) {
  e.preventDefault();
  const fullName = document.getElementById('profile-name-input').value.trim();
  try {
    const res = await Api.put('/auth/profile', { fullName });
    Auth.setUser(res.user);
    renderProfileHeader(res.user);
    Toast.success('Name updated.');
  } catch (err) {
    Toast.error(err.message);
  }
}

async function submitPasswordForm(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-new-password').value;

  if (newPassword !== confirmPassword) return Toast.warning('New passwords do not match.');

  try {
    await Api.put('/auth/password', { currentPassword, newPassword, confirmPassword });
    Toast.success('Password changed successfully.');
    document.getElementById('password-form').reset();
  } catch (err) {
    Toast.error(err.message);
  }
}
