let hwStatusFilter = 'all';
let hwAttachmentUrl = null;
let hwAttachmentName = null;

(async function () {
  if (!App.guard()) return;
  await App.renderShell('homework');
  App.bindModalDismiss();

  buildHwPills();
  document.getElementById('hw-search').addEventListener('input', App.debounce(loadHomework, 350));

  if (Auth.isAdmin()) {
    document.getElementById('fab-add-homework').classList.remove('hidden');
    document.getElementById('fab-add-homework').addEventListener('click', () => openHomeworkModal());
    document.getElementById('homework-form').addEventListener('submit', submitHomeworkForm);
    document.getElementById('hw-attachment-input').addEventListener('change', handleAttachmentUpload);
  } else {
    document.getElementById('fab-add-homework').classList.add('hidden');
  }

  await loadHomework();
  App.hideLoadingScreen();
})();

function buildHwPills() {
  const el = document.getElementById('hw-status-pills');
  const options = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
    { id: 'late', label: 'Late' }
  ];
  el.innerHTML = options.map((o) => `<button type="button" class="pill ${o.id === 'all' ? 'is-active' : ''}" data-value="${o.id}">${o.label}</button>`).join('');
  el.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      hwStatusFilter = pill.dataset.value;
      loadHomework();
    });
  });
}

async function loadHomework() {
  const list = document.getElementById('hw-list');
  list.innerHTML = App.skeletonCards(3, 100);
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('hw-search').value.trim();
    if (search) params.set('search', search);
    if (hwStatusFilter !== 'all') params.set('status', hwStatusFilter);
    params.set('limit', '100');

    const { data } = await Api.get(`/homework?${params.toString()}`);
    if (!data.length) {
      list.innerHTML = App.emptyState('icon-book', 'No homework found', 'Try a different search or filter.');
      return;
    }

    list.innerHTML = data.map((h) => renderHomeworkCard(h)).join('');
    bindHomeworkCardActions();
  } catch (err) {
    list.innerHTML = `<p class="text-muted text-sm">Couldn't load homework.</p>`;
  }
}

function renderHomeworkCard(h) {
  const statusBadge = h.completed
    ? `<span class="badge badge--present"><svg><use href="assets/svg/icons.svg#icon-check"></use></svg> Completed</span>`
    : h.isLate
      ? `<span class="badge badge--absent"><svg><use href="assets/svg/icons.svg#icon-alert"></use></svg> Late</span>`
      : `<span class="badge badge--info">${App.timeUntil(h.deadline)}</span>`;

  const adminActions = Auth.isAdmin() ? `
    <div class="row-actions">
      <button class="icon-btn" style="width:36px;height:36px" data-edit="${h.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-edit"></use></svg></button>
      <button class="icon-btn" style="width:36px;height:36px" data-delete="${h.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
    </div>` : '';

  const studentAction = !Auth.isAdmin() ? `
    <button class="btn ${h.completed ? 'btn--glass' : 'btn--primary'} btn--sm" data-toggle-complete="${h.id}">
      <svg><use href="assets/svg/icons.svg#icon-check"></use></svg> ${h.completed ? 'Completed' : 'Mark Done'}
    </button>` : '';

  return `
    <article class="glass card">
      <div class="row row--between" style="align-items:flex-start">
        <div class="row" style="gap:12px;align-items:flex-start">
          <span class="status-chip__dot" style="background:var(--blue-500);width:42px;height:42px;flex-shrink:0"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-book"></use></svg></span>
          <div>
            <p class="text-eyebrow">${App.escapeHtml(h.subject)}</p>
            <h3 class="card-title" style="margin-top:3px">${App.escapeHtml(h.title)}</h3>
            <p class="text-sm text-muted" style="margin-top:6px">${App.escapeHtml(h.description)}</p>
            <p class="text-xs text-soft" style="margin-top:8px">By ${App.escapeHtml(h.teacher)} · Due ${App.formatDateTime(h.deadline)}</p>
            ${h.attachment ? `<a class="attachment-chip" style="margin-top:10px" href="${Api.fileUrl(h.attachment)}" target="_blank" rel="noopener"><svg><use href="assets/svg/icons.svg#icon-paperclip"></use></svg> Attachment</a>` : ''}
          </div>
        </div>
        ${adminActions}
      </div>
      <div class="row row--between" style="margin-top:14px">
        ${statusBadge}
        ${studentAction}
      </div>
    </article>`;
}

function bindHomeworkCardActions() {
  document.querySelectorAll('[data-toggle-complete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.post(`/homework/${btn.dataset.toggleComplete}/complete`);
        loadHomework();
      } catch (err) { Toast.error(err.message); }
    });
  });
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const { homework } = await Api.get(`/homework/${btn.dataset.edit}`);
        openHomeworkModal(homework);
      } catch (err) { Toast.error(err.message); }
    });
  });
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this homework? This cannot be undone.')) return;
      try {
        await Api.del(`/homework/${btn.dataset.delete}`);
        Toast.success('Homework deleted.');
        loadHomework();
      } catch (err) { Toast.error(err.message); }
    });
  });
}

function openHomeworkModal(h) {
  document.getElementById('hw-modal-title').textContent = h ? 'Edit Homework' : 'New Homework';
  document.getElementById('hw-id').value = h?.id || '';
  document.getElementById('hw-subject').value = h?.subject || '';
  document.getElementById('hw-teacher').value = h?.teacher || '';
  document.getElementById('hw-title').value = h?.title || '';
  document.getElementById('hw-description').value = h?.description || '';
  document.getElementById('hw-deadline').value = h?.deadline ? toLocalInputValue(h.deadline) : '';
  hwAttachmentUrl = h?.attachment || null;
  hwAttachmentName = h?.attachment ? 'Existing attachment' : null;
  document.getElementById('hw-attachment-name').textContent = hwAttachmentName || 'No file selected';
  App.openModal('modal-homework');
}

function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function handleAttachmentUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const nameEl = document.getElementById('hw-attachment-name');
  nameEl.textContent = 'Uploading…';
  try {
    const form = new FormData();
    form.append('attachment', file);
    const res = await Api.post('/homework/upload', form, { isForm: true });
    hwAttachmentUrl = res.url;
    hwAttachmentName = res.name;
    nameEl.textContent = res.name;
  } catch (err) {
    Toast.error('Upload failed: ' + err.message);
    nameEl.textContent = 'No file selected';
  }
}

async function submitHomeworkForm(e) {
  e.preventDefault();
  const id = document.getElementById('hw-id').value;
  const payload = {
    subject: document.getElementById('hw-subject').value.trim(),
    teacher: document.getElementById('hw-teacher').value.trim(),
    title: document.getElementById('hw-title').value.trim(),
    description: document.getElementById('hw-description').value.trim(),
    deadline: new Date(document.getElementById('hw-deadline').value).toISOString(),
    attachment: hwAttachmentUrl
  };
  const btn = document.getElementById('hw-submit-btn');
  btn.disabled = true;
  try {
    if (id) {
      await Api.put(`/homework/${id}`, payload);
      Toast.success('Homework updated.');
    } else {
      await Api.post('/homework', payload);
      Toast.success('Homework created.');
    }
    App.closeModal('modal-homework');
    document.getElementById('homework-form').reset();
    loadHomework();
  } catch (err) {
    Toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
}
