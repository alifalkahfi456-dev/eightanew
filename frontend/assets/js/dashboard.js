(async function () {
  if (!App.guard()) return;
  const user = Auth.getUser();

  await App.renderShell('dashboard');
  App.bindModalDismiss();

  document.getElementById('greeting-text').textContent = `${App.greeting()}, ${user.fullName.split(' ')[0]}`;
  document.getElementById('date-text').textContent = App.formatDateLong(new Date().toISOString());

  await Promise.all([
    loadAttendanceWidget(),
    loadStats(),
    loadScheduleToday(),
    loadCleaningToday(),
    loadHomeworkPreview(),
    loadAnnouncementPreview()
  ]);

  App.hideLoadingScreen();

  // Refresh the freshest copy of the user (name/avatar may have changed elsewhere).
  try {
    const me = await Api.get('/auth/me');
    Auth.setUser(me.user);
  } catch (e) { /* non-fatal */ }
})();

const STATUS_OPTIONS = ['present', 'late', 'permission', 'sick', 'absent'];

async function loadAttendanceWidget() {
  const el = document.getElementById('attendance-widget');
  try {
    const { attendance } = await Api.get('/attendance/today');
    if (attendance) {
      const meta = App.statusMeta(attendance.status);
      el.innerHTML = `
        <div class="row row--between">
          <div>
            <p class="text-eyebrow">Today's Attendance</p>
            <h3 class="card-title" style="margin-top:4px">You're marked as <span style="color:${meta.color}">${meta.label}</span></h3>
            ${attendance.reason ? `<p class="text-sm text-muted" style="margin-top:6px">"${App.escapeHtml(attendance.reason)}"</p>` : ''}
          </div>
          <span class="status-chip__dot" style="background:${meta.color};width:44px;height:44px">
            <svg class="icon"><use href="assets/svg/icons.svg#${meta.icon}"></use></svg>
          </span>
        </div>`;
    } else {
      el.innerHTML = `
        <p class="text-eyebrow">Today's Attendance</p>
        <h3 class="card-title" style="margin:4px 0 14px">How are you joining us today?</h3>
        <div class="status-picker" id="status-picker">
          ${STATUS_OPTIONS.map((s) => {
            const meta = App.statusMeta(s);
            return `<button type="button" class="status-chip" data-status="${s}" style="--chip-color:${meta.color}">
              <span class="status-chip__dot" style="background:${meta.color}"><svg class="icon-sm"><use href="assets/svg/icons.svg#${meta.icon}"></use></svg></span>
              <span>${meta.label}</span>
            </button>`;
          }).join('')}
        </div>
        <div id="reason-wrap" class="field hidden" style="margin-top:14px">
          <label for="attendance-reason">Reason</label>
          <div class="input-shell">
            <input id="attendance-reason" type="text" placeholder="Tell us why…">
          </div>
        </div>
        <button class="btn btn--primary btn--block" id="submit-attendance" style="margin-top:14px" disabled>
          <svg><use href="assets/svg/icons.svg#icon-check"></use></svg> Submit Attendance
        </button>`;

      let selected = null;
      const submitBtn = document.getElementById('submit-attendance');
      const reasonWrap = document.getElementById('reason-wrap');
      const reasonInput = document.getElementById('attendance-reason');

      el.querySelectorAll('.status-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          el.querySelectorAll('.status-chip').forEach((c) => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
          selected = chip.dataset.status;
          submitBtn.disabled = false;
          const needsReason = selected === 'permission' || selected === 'sick';
          reasonWrap.classList.toggle('hidden', !needsReason);
        });
      });

      submitBtn.addEventListener('click', async () => {
        const needsReason = selected === 'permission' || selected === 'sick';
        if (needsReason && !reasonInput.value.trim()) {
          Toast.warning('Please enter a reason to continue.');
          reasonInput.focus();
          return;
        }
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Submitting…';
        try {
          await Api.post('/attendance', { status: selected, reason: reasonInput.value.trim() });
          Toast.success('Attendance recorded. Have a great day!');
          loadAttendanceWidget();
          loadStats();
        } catch (err) {
          Toast.error(err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<svg><use href="assets/svg/icons.svg#icon-check"></use></svg> Submit Attendance';
        }
      });
    }
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load attendance right now.</p>`;
  }
}

async function loadStats() {
  const row = document.getElementById('stats-row');
  try {
    const { stats } = await Api.get('/attendance/stats/me');
    document.getElementById('ring-percent').textContent = `${stats.rate}%`;
    const circumference = 2 * Math.PI * 34;
    const ring = document.getElementById('attendance-ring');
    ring.style.strokeDasharray = `${circumference}`;
    ring.style.strokeDashoffset = `${circumference * (1 - stats.rate / 100)}`;

    const tiles = [
      { label: 'Present', value: stats.present, color: 'var(--status-present)' },
      { label: 'Late', value: stats.late, color: 'var(--status-late)' },
      { label: 'Permission', value: stats.permission, color: 'var(--status-permission)' },
      { label: 'Sick', value: stats.sick, color: 'var(--status-sick)' },
      { label: 'Absent', value: stats.absent, color: 'var(--status-absent)' }
    ];
    row.innerHTML = tiles.map((t) => `
      <div class="glass tile" style="min-width:110px">
        <span class="tile__value" style="color:${t.color}">${t.value}</span>
        <span class="tile__label">${t.label}</span>
      </div>`).join('');
  } catch (err) {
    row.innerHTML = `<p class="text-muted text-sm">Stats unavailable.</p>`;
  }
}

async function loadScheduleToday() {
  const el = document.getElementById('schedule-today');
  try {
    const { day, schedules } = await Api.get('/schedule/today');
    if (!schedules.length) {
      el.innerHTML = App.emptyState('icon-clock', `No classes today`, `Enjoy your ${day}! Check back tomorrow.`);
      return;
    }
    el.innerHTML = schedules.map((s) => `
      <div class="list-row">
        <span class="badge badge--info">${App.formatTime12(s.startTime)}</span>
        <div class="stack" style="gap:1px;flex:1">
          <span class="font-semibold text-sm">${App.escapeHtml(s.subject)}</span>
          <span class="text-xs text-muted">${App.escapeHtml(s.teacher)} · Room ${App.escapeHtml(s.room)}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load schedule.</p>`;
  }
}

async function loadCleaningToday() {
  const el = document.getElementById('cleaning-today');
  try {
    const { day, duty } = await Api.get('/cleaning/today');
    if (!duty) {
      el.innerHTML = App.emptyState('icon-broom', 'No duty assigned', `Nobody is on cleaning duty this ${day}.`);
      return;
    }
    el.innerHTML = `
      <div class="row" style="gap:12px">
        <span class="status-chip__dot" style="background:var(--blue-500);width:44px;height:44px"><svg class="icon"><use href="assets/svg/icons.svg#icon-broom"></use></svg></span>
        <div>
          <p class="font-semibold text-sm">${App.escapeHtml(duty.area)}</p>
          <p class="text-xs text-muted">${duty.studentNames.map(App.escapeHtml).join(', ')}</p>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load cleaning duty.</p>`;
  }
}

async function loadHomeworkPreview() {
  const el = document.getElementById('homework-preview');
  try {
    const { data } = await Api.get('/homework?limit=3&page=1');
    if (!data.length) {
      el.innerHTML = App.emptyState('icon-book', 'No homework yet', 'New assignments will show up here.');
      return;
    }
    el.innerHTML = data.map((h) => `
      <a href="homework.html" class="list-row" style="text-decoration:none;color:inherit">
        <span class="status-chip__dot" style="background:${h.completed ? 'var(--success)' : h.isLate ? 'var(--danger)' : 'var(--blue-500)'};width:38px;height:38px">
          <svg class="icon-sm"><use href="assets/svg/icons.svg#${h.completed ? 'icon-check' : 'icon-book'}"></use></svg>
        </span>
        <div class="stack" style="gap:1px;flex:1;min-width:0">
          <span class="font-semibold text-sm truncate">${App.escapeHtml(h.title)}</span>
          <span class="text-xs text-muted">${App.escapeHtml(h.subject)} · ${App.timeUntil(h.deadline)}</span>
        </div>
        <svg class="icon-sm text-soft"><use href="assets/svg/icons.svg#icon-chevron-right"></use></svg>
      </a>`).join('');
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load homework.</p>`;
  }
}

async function loadAnnouncementPreview() {
  const el = document.getElementById('announcement-preview');
  try {
    const { data } = await Api.get('/announcement?limit=3&page=1');
    if (!data.length) {
      el.innerHTML = App.emptyState('icon-megaphone', 'No announcements', 'Updates from your admin will appear here.');
      return;
    }
    el.innerHTML = data.map((a) => `
      <a href="announcement.html" class="list-row" style="text-decoration:none;color:inherit">
        <span class="status-chip__dot" style="background:var(--info);width:38px;height:38px">
          <svg class="icon-sm"><use href="assets/svg/icons.svg#icon-megaphone"></use></svg>
        </span>
        <div class="stack" style="gap:1px;flex:1;min-width:0">
          <span class="font-semibold text-sm truncate">${a.pinned ? '<svg class="icon-sm" style="display:inline;vertical-align:-3px;color:var(--warning)"><use href="assets/svg/icons.svg#icon-pin"></use></svg> ' : ''}${App.escapeHtml(a.title)}</span>
          <span class="text-xs text-muted truncate">${App.escapeHtml(a.content)}</span>
        </div>
      </a>`).join('');
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load announcements.</p>`;
  }
}
