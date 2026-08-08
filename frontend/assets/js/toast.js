/**
 * Beautiful toast notifications. Usage: Toast.success('Saved!'), Toast.error(...), etc.
 */
const Toast = (() => {
  const ICONS = {
    success: '#icon-check',
    error: '#icon-x-circle',
    warning: '#icon-alert',
    info: '#icon-info'
  };
  const TITLES = { success: 'Success', error: 'Something went wrong', warning: 'Heads up', info: 'Notice' };

  function ensureStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show(type, message, title) {
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast__icon"><svg class="icon-sm"><use href="assets/svg/icons.svg${ICONS[type]}"></use></svg></span>
      <span class="toast__body">
        <span class="toast__title">${title || TITLES[type]}</span>
        <span class="toast__msg">${message}</span>
      </span>
      <button class="toast__close" aria-label="Dismiss"><svg class="icon-sm"><use href="assets/svg/icons.svg#icon-x"></use></svg></button>
    `;
    stack.appendChild(el);

    const remove = () => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 280);
    };
    el.querySelector('.toast__close').addEventListener('click', remove);
    const timer = setTimeout(remove, 4200);
    el.addEventListener('mouseenter', () => clearTimeout(timer));

    return el;
  }

  return {
    success: (msg, title) => show('success', msg, title),
    error: (msg, title) => show('error', msg, title),
    warning: (msg, title) => show('warning', msg, title),
    info: (msg, title) => show('info', msg, title)
  };
})();
