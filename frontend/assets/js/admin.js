let studentStatusFilter = 'all';
let logoUrl = null;

(async function () {
  if (!App.guard({ adminOnly: true })) return;
  await App.renderShell('more');
  App.bindModalDismiss();

  buildStudentPills();
  document.getElementById('student-search').addEventListener('input', App.debounce(loadStudents, 350));
  document.getElementById('settings-form').addEventListener('submit', submitSettingsForm);
  document.getElementById('set-logo-input').addEventListener('change', handleLogoUpload);
  document.getElementById('reset-password-form').addEventListener('submit', submitResetPassword);

  await Promise.all([loadStats(), loadStudents(), loadSettingsForm()]);
  App.hideLoadingScreen();
})();

// ============================= STATS & CHARTS ================================
async function loadStats() {
  try {
    const { stats, trend, homeworkBySubject, activities } = await Api.get('/admin/stats');

    const overview = document.getElementById('admin-overview');
    const tiles = [
      { label: 'Total Students', value: stats.totalStudents, icon: 'icon-users', color: 'var(--blue-600)' },
      { label: 'Present Today', value: stats.attendanceToday.present, icon: 'icon-check', color: 'var(--status-present)' },
      { label: 'Homework Posted', value: stats.homeworkCount, icon: 'icon-book', color: 'var(--info)' },
      { label: 'Announcements', value: stats.announcementCount, icon: 'icon-megaphone', color: 'var(--pink)' }
    ];
    overview.innerHTML = tiles.map((t) => `
      <div class="glass tile">
        <span class="status-chip__dot" style="background:${t.color};width:34px;height:34px;margin-bottom:6px"><svg class="icon-sm"><use href="assets/svg/icons.svg#${t.icon}"></use></svg></span>
        <span class="tile__value">${t.value}</span>
        <span class="tile__label">${t.label}</span>
      </div>`).join('');

    renderAttendanceChart(trend);
    renderHomeworkChart(homeworkBySubject);
    renderActivity(activities);
  } catch (err) {
    Toast.error('Could not load dashboard stats.');
  }
}

function renderAttendanceChart(trend) {
  const el = document.getElementById('attendance-chart');
  const max = Math.max(1, ...trend.map((t) => t.total));
  el.innerHTML = `
    <div class="row" style="align-items:flex-end; gap:10px; height:160px; padding-top:10px">
      ${trend.map((t) => {
        const presentH = Math.round((t.present / max) * 120);
        const lateH = Math.round((t.late / max) * 120);
        const absentH = Math.round((t.absent / max) * 120);
        const label = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' });
        return `
        <div class="stack" style="flex:1; align-items:center; gap:6px">
          <div class="row" style="align-items:flex-end; gap:3px; height:120px">
            <div title="Present: ${t.present}" style="width:8px; border-radius:4px; height:${Math.max(presentH, t.present ? 4 : 0)}px; background:var(--status-present)"></div>
            <div title="Late: ${t.late}" style="width:8px; border-radius:4px; height:${Math.max(lateH, t.late ? 4 : 0)}px; background:var(--status-late)"></div>
            <div title="Absent: ${t.absent}" style="width:8px; border-radius:4px; height:${Math.max(absentH, t.absent ? 4 : 0)}px; background:var(--status-absent)"></div>
          </div>
          <span class="text-xs text-muted font-semibold">${label}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="row" style="gap:16px; margin-top:6px; justify-content:center">
      <span class="text-xs text-muted row" style="gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--status-present);display:inline-block"></span> Present</span>
      <span class="text-xs text-muted row" style="gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--status-late);display:inline-block"></span> Late</span>
      <span class="text-xs text-muted row" style="gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--status-absent);display:inline-block"></span> Absent</span>
    </div>`;
}

function renderHomeworkChart(bySubject) {
  const el = document.getElementById('homework-chart');
  const entries = Object.entries(bySubject);
  if (!entries.length) {
    el.innerHTML = App.emptyState('icon-book', 'No homework yet', 'Create homework to see subject breakdown.');
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v));
  el.innerHTML = entries.map(([subject, count]) => `
    <div>
      <div class="row row--between" style="margin-bottom:5px">
        <span class="text-sm font-semibold">${App.escapeHtml(subject)}</span>
        <span class="text-xs text-muted">${count}</span>
      </div>
      <div class="progress"><div class="progress__fill" style="width:${(count / max) * 100}%"></div></div>
    </div>`).join('');
}

function renderActivity(activities) {
  const el = document.getElementById('activity-list');
  if (!activities.length) {
    el.innerHTML = App.emptyState('icon-empty', 'No activity yet', 'Actions across the app will show up here.');
    return;
  }
  const iconFor = { attendance: 'icon-calendar', homework: 'icon-book', announcement: 'icon-megaphone', registration: 'icon-user' };
  el.innerHTML = activities.map((a) => `
    <div class="list-row">
      <span class="status-chip__dot" style="background:var(--blue-500);width:34px;height:34px"><svg class="icon-sm"><use href="assets/svg/icons.svg#${iconFor[a.type] || 'icon-info'}"></use></svg></span>
      <div class="stack" style="gap:1px;flex:1">
        <span class="text-sm"><strong>${App.escapeHtml(a.userName)}</strong> ${App.escapeHtml(a.text)}</span>
        <span class="text-xs text-soft">${App.formatDateTime(a.at)}</span>
      </div>
    </div>`).join('');
}

// ============================= STUDENTS =======================================
function buildStudentPills() {
  const el = document.getElementById('student-status-pills');
  const options = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'disabled', label: 'Disabled' }];
  el.innerHTML = options.map((o) => `<button type="button" class="pill ${o.id === 'all' ? 'is-active' : ''}" data-value="${o.id}">${o.label}</button>`).join('');
  el.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      studentStatusFilter = pill.dataset.value;
      loadStudents();
    });
  });
}

async function loadStudents() {
  const wrap = document.getElementById('student-table-wrap');
  wrap.innerHTML = `<div class="stack">${App.skeletonCards(4, 44)}</div>`;
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('student-search').value.trim();
    if (search) params.set('search', search);
    if (studentStatusFilter !== 'all') params.set('status', studentStatusFilter);
    params.set('limit', '200');

    const { data, pagination } = await Api.get(`/admin/students?${params.toString()}`);
    document.getElementById('student-count-badge').textContent = `${pagination.total} total`;

    if (!data.length) {
      wrap.innerHTML = App.emptyState('icon-users', 'No students found', 'Try a different search or filter.');
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Student</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.map((s) => `
            <tr>
              <td class="row" style="gap:10px">${App.avatarHtml(s, 'sm')} <span>${App.escapeHtml(s.fullName)}</span></td>
              <td><span class="badge ${s.disabled ? 'badge--absent' : 'badge--present'}">${s.disabled ? 'Disabled' : 'Active'}</span></td>
              <td class="text-muted">${App.formatDate(s.createdAt)}</td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn" style="width:34px;height:34px" title="Reset password" data-reset="${s.id}" data-name="${App.escapeHtml(s.fullName)}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-lock"></use></svg></button>
                  <button class="switch ${s.disabled ? '' : 'is-on'}" title="Toggle active" data-toggle="${s.id}" style="width:40px;height:24px"></button>
                  <button class="icon-btn" style="width:34px;height:34px" title="Delete student" data-delete="${s.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    bindStudentActions();
  } catch (err) {
    wrap.innerHTML = `<p class="text-muted text-sm">Couldn't load students.</p>`;
  }
}

function bindStudentActions() {
  document.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('reset-student-id').value = btn.dataset.reset;
      document.getElementById('reset-student-name').textContent = `Setting a new password for ${btn.dataset.name}.`;
      document.getElementById('reset-new-password').value = '';
      App.openModal('modal-reset-password');
    });
  });
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.put(`/admin/students/${btn.dataset.toggle}/disable`, {});
        loadStudents();
      } catch (err) { Toast.error(err.message); }
    });
  });
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Permanently delete this student and all their records?')) return;
      try {
        await Api.del(`/admin/students/${btn.dataset.delete}`);
        Toast.success('Student removed.');
        loadStudents();
        loadStats();
      } catch (err) { Toast.error(err.message); }
    });
  });
}

async function submitResetPassword(e) {
  e.preventDefault();
  const id = document.getElementById('reset-student-id').value;
  const newPassword = document.getElementById('reset-new-password').value;
  if (newPassword.length < 6) return Toast.warning('Password must be at least 6 characters.');
  try {
    await Api.put(`/admin/students/${id}/reset-password`, { newPassword });
    Toast.success('Password reset successfully.');
    App.closeModal('modal-reset-password');
  } catch (err) {
    Toast.error(err.message);
  }
}

// ============================= SETTINGS ========================================
async function loadSettingsForm() {
  try {
    const { settings } = await Api.get('/admin/settings');
    document.getElementById('set-school-name').value = settings.schoolName || '';
    document.getElementById('set-class-name').value = settings.className || '';
    document.getElementById('set-attendance-time').value = settings.attendanceTime || '07:30';
    document.getElementById('set-attendance-close').value = settings.attendanceCloseTime || '08:00';
    document.getElementById('set-theme').value = settings.theme || 'blue';
    logoUrl = settings.logo || null;
    document.getElementById('set-logo-name').textContent = logoUrl ? 'Current logo set' : 'No file selected';
  } catch (err) { /* non-fatal */ }
}

async function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const nameEl = document.getElementById('set-logo-name');
  nameEl.textContent = 'Uploading…';
  try {
    const form = new FormData();
    form.append('attachment', file);
    const res = await Api.post('/homework/upload', form, { isForm: true });
    logoUrl = res.url;
    nameEl.textContent = res.name;
  } catch (err) {
    Toast.error('Upload failed: ' + err.message);
    nameEl.textContent = 'No file selected';
  }
}

async function submitSettingsForm(e) {
  e.preventDefault();
  const payload = {
    schoolName: document.getElementById('set-school-name').value.trim(),
    className: document.getElementById('set-class-name').value.trim(),
    attendanceTime: document.getElementById('set-attendance-time').value,
    attendanceCloseTime: document.getElementById('set-attendance-close').value,
    theme: document.getElementById('set-theme').value,
    logo: logoUrl
  };
  try {
    await Api.put('/admin/settings', payload);
    Toast.success('Settings updated.');
  } catch (err) {
    Toast.error(err.message);
  }
}
