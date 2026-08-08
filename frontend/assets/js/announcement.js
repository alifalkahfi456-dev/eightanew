let anPinnedOnly = false;

(async function () {
  if (!App.guard()) return;
  await App.renderShell('more');
  App.bindModalDismiss();

  buildAnPills();
  document.getElementById('an-search').addEventListener('input', App.debounce(loadAnnouncements, 350));

  if (Auth.isAdmin()) {
    document.getElementById('fab-add-announcement').classList.remove('hidden');
    document.getElementById('fab-add-announcement').addEventListener('click', () => openAnnouncementModal());
    document.getElementById('announcement-form').addEventListener('submit', submitAnnouncementForm);
  } else {
    document.getElementById('fab-add-announcement').classList.add('hidden');
  }

  await loadAnnouncements();
  App.hideLoadingScreen();
})();

function buildAnPills() {
  const el = document.getElementById('an-pills');
  el.innerHTML = `
    <button type="button" class="pill is-active" data-value="all">All</button>
    <button type="button" class="pill" data-value="pinned"><svg><use href="assets/svg/icons.svg#icon-pin"></use></svg> Pinned</button>`;
  el.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      el.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      anPinnedOnly = pill.dataset.value === 'pinned';
      loadAnnouncements();
    });
  });
}

async function loadAnnouncements() {
  const list = document.getElementById('an-list');
  list.innerHTML = App.skeletonCards(3, 110);
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('an-search').value.trim();
    if (search) params.set('search', search);
    if (anPinnedOnly) params.set('pinned', 'true');
    params.set('limit', '100');

    const { data } = await Api.get(`/announcement?${params.toString()}`);
    if (!data.length) {
      list.innerHTML = App.emptyState('icon-megaphone', 'No announcements', 'Check back later for updates.');
      return;
    }
    list.innerHTML = data.map(renderAnnouncementCard).join('');
    bindAnnouncementActions();
  } catch (err) {
    list.innerHTML = `<p class="text-muted text-sm">Couldn't load announcements.</p>`;
  }
}

function renderAnnouncementCard(a) {
  const adminActions = Auth.isAdmin() ? `
    <div class="row-actions">
      <button class="icon-btn ${a.pinned ? 'icon-btn--dot' : ''}" style="width:34px;height:34px" data-pin="${a.id}" title="Toggle pin"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-pin"></use></svg></button>
      <button class="icon-btn" style="width:34px;height:34px" data-edit='${JSON.stringify(a).replace(/'/g, '&#39;')}'><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-edit"></use></svg></button>
      <button class="icon-btn" style="width:34px;height:34px" data-delete="${a.id}"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-trash"></use></svg></button>
    </div>` : '';
  return `
    <article class="glass card">
      <div class="row row--between" style="align-items:flex-start">
        <div class="row" style="gap:12px;align-items:flex-start">
          <span class="status-chip__dot" style="background:var(--info);width:42px;height:42px;flex-shrink:0"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-megaphone"></use></svg></span>
          <div>
            ${a.pinned ? `<span class="badge badge--pinned" style="margin-bottom:6px"><svg><use href="assets/svg/icons.svg#icon-pin"></use></svg> Pinned</span>` : ''}
            <h3 class="card-title">${App.escapeHtml(a.title)}</h3>
            <p class="text-sm text-muted" style="margin-top:6px; white-space:pre-line">${App.escapeHtml(a.content)}</p>
            <p class="text-xs text-soft" style="margin-top:10px">${App.escapeHtml(a.authorName || 'Admin')} · ${App.formatDateTime(a.createdAt)}</p>
          </div>
        </div>
        ${adminActions}
      </div>
    </article>`;
}

function bindAnnouncementActions() {
  document.querySelectorAll('[data-pin]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.put(`/announcement/${btn.dataset.pin}/pin`);
        loadAnnouncements();
      } catch (err) { Toast.error(err.message); }
    });
  });
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openAnnouncementModal(JSON.parse(btn.getAttribute('data-edit'))));
  });
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this announcement?')) return;
      try {
        await Api.del(`/announcement/${btn.dataset.delete}`);
        Toast.success('Announcement deleted.');
        loadAnnouncements();
      } catch (err) { Toast.error(err.message); }
    });
  });
}

function openAnnouncementModal(a) {
  document.getElementById('an-modal-title').textContent = a ? 'Edit Announcement' : 'New Announcement';
  document.getElementById('an-id').value = a?.id || '';
  document.getElementById('an-title').value = a?.title || '';
  document.getElementById('an-content').value = a?.content || '';
  document.getElementById('an-pinned').checked = !!a?.pinned;
  document.getElementById('an-pinned').closest('.checkbox-tile').classList.toggle('is-selected', !!a?.pinned);
  App.openModal('modal-announcement');
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'an-pinned') {
    e.target.closest('.checkbox-tile').classList.toggle('is-selected', e.target.checked);
  }
});

async function submitAnnouncementForm(e) {
  e.preventDefault();
  const id = document.getElementById('an-id').value;
  const payload = {
    title: document.getElementById('an-title').value.trim(),
    content: document.getElementById('an-content').value.trim(),
    pinned: document.getElementById('an-pinned').checked
  };
  const btn = document.getElementById('an-submit-btn');
  btn.disabled = true;
  try {
    if (id) { await Api.put(`/announcement/${id}`, payload); Toast.success('Announcement updated.'); }
    else { await Api.post('/announcement', payload); Toast.success('Announcement published.'); }
    App.closeModal('modal-announcement');
    document.getElementById('announcement-form').reset();
    loadAnnouncements();
  } catch (err) {
    Toast.error(err.message);
  } finally {
    btn.disabled = false;
  }
}
