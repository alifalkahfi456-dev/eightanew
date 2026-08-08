const STATUS_LIST = ['present', 'late', 'permission', 'sick', 'absent'];
let studentStatusFilter = 'all';
let adminStatusFilter = 'all';
let adminFilteredCache = [];

(async function () {
  if (!App.guard()) return;
  await App.renderShell('attendance');
  App.bindModalDismiss();

  if (Auth.isAdmin()) {
    document.getElementById('admin-view').classList.remove('hidden');
    initAdminView();
  } else {
    document.getElementById('student-view').classList.remove('hidden');
    initStudentView();
  }
})();

// ============================= STUDENT =====================================
async function initStudentView() {
  buildStatusPills('student-filter-pills', (status) => {
    studentStatusFilter = status;
    renderStudentHistory();
  });
  await Promise.all([loadAttendanceWidgetShared(), loadStudentStats(), loadStudentHistory()]);
  App.hideLoadingScreen();
}

let studentHistoryCache = [];

async function loadAttendanceWidgetShared() {
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
          ${STATUS_LIST.map((s) => {
            const meta = App.statusMeta(s);
            return `<button type="button" class="status-chip" data-status="${s}" style="--chip-color:${meta.color}">
              <span class="status-chip__dot" style="background:${meta.color}"><svg class="icon-sm"><use href="assets/svg/icons.svg#${meta.icon}"></use></svg></span>
              <span>${meta.label}</span>
            </button>`;
          }).join('')}
        </div>
        <div id="reason-wrap" class="field hidden" style="margin-top:14px">
          <label for="attendance-reason">Reason</label>
          <div class="input-shell"><input id="attendance-reason" type="text" placeholder="Tell us why…"></div>
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
          reasonWrap.classList.toggle('hidden', !(selected === 'permission' || selected === 'sick'));
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
        try {
          await Api.post('/attendance', { status: selected, reason: reasonInput.value.trim() });
          Toast.success('Attendance recorded. Have a great day!');
          loadAttendanceWidgetShared();
          loadStudentStats();
          loadStudentHistory();
        } catch (err) {
          Toast.error(err.message);
          submitBtn.disabled = false;
        }
      });
    }
  } catch (err) {
    el.innerHTML = `<p class="text-muted text-sm">Couldn't load attendance right now.</p>`;
  }
}

async function loadStudentStats() {
  const row = document.getElementById('stats-row');
  try {
    const { stats } = await Api.get('/attendance/stats/me');
    const tiles = [
      { label: 'Present', value: stats.present, color: 'var(--status-present)' },
      { label: 'Late', value: stats.late, color: 'var(--status-late)' },
      { label: 'Permission', value: stats.permission, color: 'var(--status-permission)' },
      { label: 'Sick', value: stats.sick, color: 'var(--status-sick)' },
      { label: 'Absent', value: stats.absent, color: 'var(--status-absent)' },
      { label: 'Rate', value: `${stats.rate}%`, color: 'var(--blue-600)' }
    ];
    row.innerHTML = tiles.map((t) => `
      <div class="glass tile" style="min-width:100px">
        <span class="tile__value" style="color:${t.color}">${t.value}</span>
        <span class="tile__label">${t.label}</span>
      </div>`).join('');
  } catch (err) { /* non-fatal */ }
}

async function loadStudentHistory() {
  try {
    const { data } = await Api.get('/attendance/me?limit=100');
    studentHistoryCache = data;
    renderStudentHistory();
  } catch (err) {
    document.getElementById('student-history').innerHTML = `<p class="text-muted text-sm">Couldn't load history.</p>`;
  }
}

function renderStudentHistory() {
  const el = document.getElementById('student-history');
  const filtered = studentStatusFilter === 'all' ? studentHistoryCache : studentHistoryCache.filter((a) => a.status === studentStatusFilter);
  if (!filtered.length) {
    el.innerHTML = App.emptyState('icon-calendar', 'No records found', 'Your attendance history will appear here.');
    return;
  }
  el.innerHTML = filtered.map((a) => {
    const meta = App.statusMeta(a.status);
    return `<div class="list-row">
      <span class="status-chip__dot" style="background:${meta.color};width:38px;height:38px"><svg class="icon-sm"><use href="assets/svg/icons.svg#${meta.icon}"></use></svg></span>
      <div class="stack" style="gap:1px;flex:1">
        <span class="font-semibold text-sm">${App.formatDate(a.date)}</span>
        ${a.reason ? `<span class="text-xs text-muted">${App.escapeHtml(a.reason)}</span>` : ''}
      </div>
      <span class="badge badge--${a.status}">${meta.label}</span>
    </div>`;
  }).join('');
}

// ============================== ADMIN =======================================
async function initAdminView() {
  buildStatusPills('admin-status-pills', (status) => {
    adminStatusFilter = status;
    loadAdminTable();
  });

  document.getElementById('admin-search').addEventListener('input', App.debounce(loadAdminTable, 350));
  document.getElementById('admin-date-filter').addEventListener('change', loadAdminTable);

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
  document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
  document.getElementById('btn-export-pdf').addEventListener('click', exportPdf);
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  document.getElementById('edit-attendance-form').addEventListener('submit', submitEditAttendance);

  await Promise.all([loadAdminStatsRow(), loadAdminTable()]);
  App.hideLoadingScreen();
}

function buildStatusPills(containerId, onChange) {
  const el = document.getElementById(containerId);
  const options = [{ id: 'all', label: 'All' }, ...STATUS_LIST.map((s) => ({ id: s, label: App.statusMeta(s).label }))];
  el.innerHTML = options.map((o) => `<button type="button" class="pill ${o.id === 'all' ? 'is-active' : ''}" data-value="${o.id}">${o.label}</button>`).join('');
  el.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      onChange(pill.dataset.value);
    });
  });
}

async function loadAdminStatsRow() {
  const row = document.getElementById('admin-stats-row');
  try {
    const { stats } = await Api.get('/admin/stats');
    const a = stats.attendanceToday;
    const tiles = [
      { label: 'Total Students', value: stats.totalStudents, color: 'var(--blue-600)' },
      { label: 'Present Today', value: a.present, color: 'var(--status-present)' },
      { label: 'Late Today', value: a.late, color: 'var(--status-late)' },
      { label: 'Permission', value: a.permission, color: 'var(--status-permission)' },
      { label: 'Sick', value: a.sick, color: 'var(--status-sick)' },
      { label: 'Absent', value: a.absent, color: 'var(--status-absent)' }
    ];
    row.innerHTML = tiles.map((t) => `
      <div class="glass tile" style="min-width:120px">
        <span class="tile__value" style="color:${t.color}">${t.value}</span>
        <span class="tile__label">${t.label}</span>
      </div>`).join('');
  } catch (err) { /* non-fatal */ }
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = document.getElementById('admin-search').value.trim();
  const date = document.getElementById('admin-date-filter').value;
  if (search) params.set('search', search);
  if (date) params.set('date', date);
  if (adminStatusFilter !== 'all') params.set('status', adminStatusFilter);
  params.set('limit', '500');
  return params.toString();
}

async function loadAdminTable() {
  const wrap = document.getElementById('admin-table-wrap');
  wrap.innerHTML = `<div class="stack">${App.skeletonCards(4, 44)}</div>`;
  try {
    const { data } = await Api.get(`/attendance?${buildQuery()}`);
    adminFilteredCache = data;
    if (!data.length) {
      wrap.innerHTML = App.emptyState('icon-calendar', 'No records found', 'Try adjusting your filters.');
      return;
    }
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Student</th><th>Status</th><th>Reason</th><th class="no-print">Actions</th></tr></thead>
        <tbody>
          ${data.map((a) => {
            const meta = App.statusMeta(a.status);
            return `<tr>
              <td>${App.formatDate(a.date)}</td>
              <td>${App.escapeHtml(a.studentName)}</td>
              <td><span class="badge badge--${a.status}">${meta.label}</span></td>
              <td class="text-muted">${a.reason ? App.escapeHtml(a.reason) : '—'}</td>
              <td class="no-print">
                <div class="row-actions">
                  <button class="icon-btn" style="width:34px;height:34px" onclick="openEditAttendance('${a.id}','${a.status}','${App.escapeHtml(a.reason || '')}')"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-edit"></use></svg></button>
                  <button class="icon-btn" style="width:34px;height:34px" onclick="deleteAttendance('${a.id}')"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="text-muted text-sm">Couldn't load attendance records.</p>`;
  }
}

function openEditAttendance(id, status, reason) {
  document.getElementById('edit-attendance-id').value = id;
  document.getElementById('edit-attendance-reason').value = reason;
  const picker = document.getElementById('edit-status-picker');
  picker.innerHTML = STATUS_LIST.map((s) => {
    const meta = App.statusMeta(s);
    return `<button type="button" class="status-chip ${s === status ? 'is-selected' : ''}" data-status="${s}" style="--chip-color:${meta.color}">
      <span class="status-chip__dot" style="background:${meta.color}"><svg class="icon-sm"><use href="assets/svg/icons.svg#${meta.icon}"></use></svg></span>
      <span>${meta.label}</span>
    </button>`;
  }).join('');
  picker.querySelectorAll('.status-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      picker.querySelectorAll('.status-chip').forEach((c) => c.classList.remove('is-selected'));
      chip.classList.add('is-selected');
    });
  });
  App.openModal('modal-edit-attendance');
}

async function submitEditAttendance(e) {
  e.preventDefault();
  const id = document.getElementById('edit-attendance-id').value;
  const selectedChip = document.querySelector('#edit-status-picker .status-chip.is-selected');
  const status = selectedChip ? selectedChip.dataset.status : null;
  const reason = document.getElementById('edit-attendance-reason').value.trim();
  try {
    await Api.put(`/attendance/${id}`, { status, reason });
    Toast.success('Attendance record updated.');
    App.closeModal('modal-edit-attendance');
    loadAdminTable();
    loadAdminStatsRow();
  } catch (err) {
    Toast.error(err.message);
  }
}

async function deleteAttendance(id) {
  if (!confirm('Delete this attendance record? This cannot be undone.')) return;
  try {
    await Api.del(`/attendance/${id}`);
    Toast.success('Record deleted.');
    loadAdminTable();
    loadAdminStatsRow();
  } catch (err) {
    Toast.error(err.message);
  }
}

// ============================== EXPORTS =======================================
async function exportCsv() {
  try {
    const token = Auth.getToken();
    const res = await fetch(`${window.APP_CONFIG.apiBaseUrl}/attendance/export?${buildQuery()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    downloadBlob(blob, 'attendance-export.csv');
    Toast.success('CSV exported.');
  } catch (err) {
    Toast.error('Could not export CSV.');
  }
}

function exportExcel() {
  if (!adminFilteredCache.length) return Toast.warning('Nothing to export yet.');
  const rows = adminFilteredCache.map((a) => ({
    Date: a.date, Student: a.studentName, Status: a.status, Reason: a.reason || '', 'Submitted At': a.createdAt
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, 'attendance-export.xlsx');
  Toast.success('Excel file exported.');
}

function exportPdf() {
  if (!adminFilteredCache.length) return Toast.warning('Nothing to export yet.');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Attendance Report', 14, 16);
  doc.autoTable({
    startY: 22,
    head: [['Date', 'Student', 'Status', 'Reason']],
    body: adminFilteredCache.map((a) => [a.date, a.studentName, a.status, a.reason || '—']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [10, 132, 255] }
  });
  doc.save('attendance-export.pdf');
  Toast.success('PDF exported.');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
