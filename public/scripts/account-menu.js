(function () {
  'use strict';

  var root = document.querySelector('[data-account-menu-root]');
  if (!root) return;

  var trigger = root.querySelector('[data-account-menu-trigger]');
  var menu = root.querySelector('[data-account-menu]');
  if (!trigger || !menu) return;

  function items() {
    return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
  }

  function isOpen() {
    return trigger.getAttribute('aria-expanded') === 'true';
  }

  function open(focusLast) {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    var available = items();
    var target = focusLast ? available[available.length - 1] : available[0];
    if (target) target.focus();
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (returnFocus) trigger.focus();
  }

  trigger.addEventListener('click', function () {
    if (isOpen()) close(false);
    else open(false);
  });

  trigger.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    open(event.key === 'ArrowUp');
  });

  menu.addEventListener('keydown', function (event) {
    var available = items();
    var index = available.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var direction = event.key === 'ArrowDown' ? 1 : -1;
      available[(index + direction + available.length) % available.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      available[event.key === 'Home' ? 0 : available.length - 1].focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  });

  document.addEventListener('click', function (event) {
    if (isOpen() && !root.contains(event.target)) close(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) close(true);
  });

  root.querySelector('[data-account-signout]')?.addEventListener('click', function () {
    document.dispatchEvent(new CustomEvent('axiora:signout'));
    close(false);
  });
})();
