(function () {
  'use strict';

  var STORAGE_KEY = 'axiora-theme';
  var root = document.documentElement;
  var stored = null;

  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    stored = null;
  }

  var preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
  var initial = stored === 'light' || stored === 'dark' ? stored : preferred;

  function updateControls(theme) {
    var nextLabel = theme === 'dark' ? 'Mode terang' : 'Mode gelap';
    var nextIcon = theme === 'dark' ? '\u2600' : '\u263E';
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    var labels = document.querySelectorAll('[data-theme-label]');
    var icons = document.querySelectorAll('[data-theme-icon]');
    var options = document.querySelectorAll('[data-theme-option]');
    var meta = document.querySelector('meta[name="theme-color"]');

    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].setAttribute('aria-label', nextLabel);
    }
    for (var j = 0; j < labels.length; j += 1) labels[j].textContent = nextLabel;
    for (var k = 0; k < icons.length; k += 1) icons[k].textContent = nextIcon;
    for (var n = 0; n < options.length; n += 1) {
      options[n].setAttribute('aria-pressed', String(options[n].getAttribute('data-theme-option') === theme));
    }
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f6f2' : '#0d0e0c');
  }

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch (_) {
        /* Preference remains active for this page when storage is unavailable. */
      }
    }
    updateControls(theme);
  }

  applyTheme(initial, false);

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-theme-toggle], [data-theme-option]')
      : null;
    if (!target) return;
    var selected = target.getAttribute('data-theme-option');
    var current = root.getAttribute('data-theme') || 'dark';
    applyTheme(selected || (current === 'dark' ? 'light' : 'dark'), true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { updateControls(root.getAttribute('data-theme') || initial); });
  } else {
    updateControls(root.getAttribute('data-theme') || initial);
  }
})();
