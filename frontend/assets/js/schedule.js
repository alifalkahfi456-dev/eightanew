const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let scDayFilter = 'all';

(async function () {
  if (!App.guard()) return;
  await App.renderShell('schedule');
  App.bindModalDismiss();

  buildDayPills();
  document.getElementById('sc-search').addEventListener('input', App.debounce(loadSchedule, 350));

  if (Auth.isAdmin()) {
    document.getElementById('fab-add-schedule').classList.remove('hidden');
    document.getElementById('fab-add-schedule').addEventListener('click', () => openScheduleModal());
    document.getElementById('schedule-form').addEventListener('submit', submitScheduleForm);
  } else {
    document.getElementById('fab-add-schedule').classList.add('hidden');
  }

  await loadSchedule();
  App.hideLoadingScreen();
})();

function buildDayPills() {
  const el = document.getElementById('sc-day-pills');
  const options = [{ id: 'all', label: 'Whole Week' }, ...DAYS.map((d) => ({ id: d, label: d.slice(0, 3) }))];
  el.innerHTML = options.map((o) => `<button type="button" class="pill ${o.id === 'all' ? 'is-active' : ''}" data-value="${o.id}">${o.label}</button>`).join('');
  el.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      scDayFilter = pill.dataset.value;
      loadSchedule();
    });
  });
}

async function loadSchedule() {
  const list = document.getElementById('sc-list');
  list.innerHTML = App.skeletonCards(3, 76);
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('sc-search').value.trim();
    if (search) params.set('search', search);
    if (scDayFilter !== 'all') params.set('day', scDayFilter);

    const { schedules } = await Api.get(`/schedule?${params.toString()}`);
    if (!schedules.length) {
      list.innerHTML = App.emptyState('icon-clock', 'No classes found', 'Try a different day or search term.');
      return;
    }

    if (scDayFilter !== 'all') {
      list.innerHTML = `<div class="glass card list-card">${schedules.map(renderScheduleRow).join('')}</div>`;
    } else {
      const grouped = DAYS.map((d) => ({ day: d, items: schedules.filter((s) => s.day === d) })).filter((g) => g.items.length);
      list.innerHTML = grouped.map((g) => `
        <div class="glass card">
          <p class="text-eyebrow" style="margin-bottom:10px">${g.day}</p>
          <div class="list-card">${g.items.map(renderScheduleRow).join('')}</div>
        </div>`).join('');
    }
    bindScheduleActions();
  } catch (err) {
    list.innerHTML = `<p class="text-muted text-sm">Couldn't load schedule.</p>`;
  }
}

function renderScheduleRow(s) {
  const adminActions = Auth.isAdmin() ? `
    <div class="row-actions">
      <button class="icon-btn" style="width:34px;height:34px" data-edit='${JSON.stringify(s).replace(/'/g, '&#39;')}'><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-edit"></use></svg></button>
      <button class="icon-btn" style="width:34px;height:34px" data-delete="${s.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
    </div>` : '';
  return `
    <div class="list-row">
      <span class="badge badge--info">${App.formatTime12(s.startTime)} – ${App.formatTime12(s.endTime)}</span>
      <div class="stack" style="gap:1px;flex:1;min-width:0">
        <span class="font-semibold text-sm truncate">${App.escapeHtml(s.subject)}</span>
        <span class="text-xs text-muted truncate">${App.escapeHtml(s.teacher)} · Room ${App.escapeHtml(s.room)}</span>
      </div>
      ${adminActions}
    </div>`;
}

function bindScheduleActions() {
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openScheduleModal(JSON.parse(btn.getAttribute('data-edit'))));
  });
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this class from the schedule?')) return;
      try {
        await Api.del(`/schedule/${btn.dataset.delete}`);
        Toast.success('Schedule item deleted.');
        loadSchedule();
      } catch (err) { Toast.error(err.message); }
    });
  });
}

function openScheduleModal(s) {
  document.getElementById('sc-modal-title').textContent = s ? 'Edit Class' : 'New Class';
  document.getElementById('sc-id').value = s?.id || '';
  document.getElementById('sc-day').value = s?.day || 'Monday';
  document.getElementById('sc-start').value = s?.startTime || '';
  document.getElementById('sc-end').value = s?.endTime || '';
  document.getElementById('sc-subject').value = s?.subject || '';
  document.getElementById('sc-teacher').value = s?.teacher || '';
  document.getElementById('sc-room').value = s?.room || '';
  App.openModal('modal-schedule');
}

async function submitScheduleForm(e) {
  e.preventDefault();
  const id = document.getElementById('sc-id').value;
  const payload = {
    day: document.getElementById('sc-day').value,
    startTime: document.getElementById('sc-start').value,
    endTime: document.getElementById('sc-end').value,
    subject: document.getElementById('sc-subject').value.trim(),
    teacher: document.getElementById('sc-teacher').value.trim(),
    room: document.getElementById('sc-room').value.trim()
  };
  const btn = document.getElementById('sc-submit-btn');
  btn.disabled = true;
  try {
    if (id) { await Api.put(`/schedule/${id}`, payload); Toast.success('Class updated.'); }
    else { await Api.post('/schedule', payload); Toast.success('Class added.'); }
    App.closeModal('modal-schedule');
    document.getElementById('schedule-form').reset();
    loadSchedule();
  } catch (err) {
    Toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
}
