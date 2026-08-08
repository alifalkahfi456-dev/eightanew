const CL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let cleaningStudents = [];

(async function () {
  if (!App.guard()) return;
  await App.renderShell('more');
  App.bindModalDismiss();

  if (Auth.isAdmin()) {
    document.getElementById('fab-add-cleaning').classList.remove('hidden');
    document.getElementById('fab-add-cleaning').addEventListener('click', () => openCleaningModal());
    document.getElementById('cleaning-form').addEventListener('submit', submitCleaningForm);
    await loadStudentsForAssignment();
  } else {
    document.getElementById('fab-add-cleaning').classList.add('hidden');
  }

  document.getElementById('cl-search').addEventListener('input', App.debounce(renderCleaningWeek, 250));

  await Promise.all([loadCleaningToday(), loadCleaningWeek()]);
  App.hideLoadingScreen();
})();

async function loadStudentsForAssignment() {
  try {
    const { data } = await Api.get('/admin/students?limit=200');
    cleaningStudents = data;
  } catch (err) { /* non-fatal */ }
}

async function loadCleaningToday() {
  const el = document.getElementById('cleaning-today');
  try {
    const { day, duty } = await Api.get('/cleaning/today');
    if (!duty) {
      el.innerHTML = `<p class="text-sm text-muted">No one is assigned for ${day}.</p>`;
      return;
    }
    el.innerHTML = `
      <div class="row" style="gap:12px">
        <span class="status-chip__dot" style="background:var(--blue-500);width:48px;height:48px"><svg class="icon"><use href="assets/svg/icons.svg#icon-broom"></use></svg></span>
        <div>
          <p class="card-title">${App.escapeHtml(duty.area)}</p>
          <p class="text-sm text-muted">${duty.studentNames.map(App.escapeHtml).join(', ')}</p>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="text-sm text-muted">Couldn't load today's duty.</p>`;
  }
}

let CL_dutiesCache = [];

async function loadCleaningWeek() {
  const el = document.getElementById('cleaning-week');
  try {
    const { duties } = await Api.get('/cleaning');
    CL_dutiesCache = duties;
    renderCleaningWeek();
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load the weekly roster.</p>`;
  }
}

function renderCleaningWeek() {
  const el = document.getElementById('cleaning-week');
  const q = (document.getElementById('cl-search').value || '').trim().toLowerCase();
  const duties = q
    ? CL_dutiesCache.filter((d) => d.area.toLowerCase().includes(q) || d.studentNames.some((n) => n.toLowerCase().includes(q)))
    : CL_dutiesCache;

  if (!duties.length) {
      el.innerHTML = App.emptyState('icon-broom', 'No duties found', q ? 'Try a different search term.' : 'Set up the weekly cleaning roster to get started.');
      return;
    }
    el.innerHTML = duties.map((d) => {
      const adminActions = Auth.isAdmin() ? `
        <div class="row-actions">
          <button class="icon-btn" style="width:34px;height:34px" data-edit='${JSON.stringify(d).replace(/'/g, '&#39;')}'><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-edit"></use></svg></button>
          <button class="icon-btn" style="width:34px;height:34px" data-delete="${d.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
        </div>` : '';
      return `
      <div class="glass card">
        <div class="row row--between">
          <div class="row" style="gap:12px">
            <span class="status-chip__dot" style="background:var(--blue-500);width:40px;height:40px"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-broom"></use></svg></span>
            <div>
              <p class="text-eyebrow">${d.day}</p>
              <p class="font-semibold text-sm" style="margin-top:2px">${App.escapeHtml(d.area)}</p>
              <p class="text-xs text-muted" style="margin-top:2px">${d.studentNames.map(App.escapeHtml).join(', ') || 'No students assigned'}</p>
            </div>
          </div>
          ${adminActions}
        </div>
      </div>`;
    }).join('');
    bindCleaningActions();
}

function bindCleaningActions() {
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openCleaningModal(JSON.parse(btn.getAttribute('data-edit'))));
  });
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this cleaning duty assignment?')) return;
      try {
        await Api.del(`/cleaning/${btn.dataset.delete}`);
        Toast.success('Duty removed.');
        loadCleaningWeek();
        loadCleaningToday();
      } catch (err) { Toast.error(err.message); }
    });
  });
}

function openCleaningModal(d) {
  document.getElementById('cl-modal-title').textContent = d ? 'Edit Duty' : 'Assign Cleaning Duty';
  document.getElementById('cl-id').value = d?.id || '';
  document.getElementById('cl-day').value = d?.day || 'Monday';
  document.getElementById('cl-area').value = d?.area || '';

  const wrap = document.getElementById('cl-students');
  const selectedIds = new Set(d?.studentIds || []);
  wrap.innerHTML = cleaningStudents.map((s) => `
    <label class="checkbox-tile ${selectedIds.has(s.id) ? 'is-selected' : ''}">
      <input type="checkbox" value="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}>
      <span class="text-sm">${App.escapeHtml(s.fullName)}</span>
    </label>`).join('') || '<p class="text-sm text-muted">No students registered yet.</p>';

  wrap.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => cb.closest('.checkbox-tile').classList.toggle('is-selected', cb.checked));
  });

  App.openModal('modal-cleaning');
}

async function submitCleaningForm(e) {
  e.preventDefault();
  const id = document.getElementById('cl-id').value;
  const studentIds = Array.from(document.querySelectorAll('#cl-students input:checked')).map((cb) => cb.value);
  if (!studentIds.length) return Toast.warning('Assign at least one student.');

  const payload = { day: document.getElementById('cl-day').value, area: document.getElementById('cl-area').value.trim(), studentIds };
  const btn = document.getElementById('cl-submit-btn');
  btn.disabled = true;
  try {
    if (id) { await Api.put(`/cleaning/${id}`, payload); Toast.success('Duty updated.'); }
    else { await Api.post('/cleaning', payload); Toast.success('Duty assigned.'); }
    App.closeModal('modal-cleaning');
    document.getElementById('cleaning-form').reset();
    loadCleaningWeek();
    loadCleaningToday();
  } catch (err) {
    Toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
}
