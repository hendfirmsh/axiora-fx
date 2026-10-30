/**
 * AXIORA Intelligence News — progressive enhancement.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            04_Workspace_Architecture/11_Interaction_Specification.md,
 *            13_Accessibility_Workspace.md (state conveyed as text, live regions).
 *
 * WHAT THIS SCRIPT DOES
 *
 *   - Filters already-rendered cards by category and a free-text query.
 *   - Keeps the result count in a polite live region.
 *   - Exposes no-results and reset behaviour without a page reload.
 *
 * WHAT IT DOES NOT DO
 *
 *   - No fetch, no Marketaux call, no credential.
 *   - No innerHTML: every change is a class, attribute, or textContent update.
 *   - No hidden dependency: every card is visible in the HTML before this file
 *     runs, so a failed load degrades to the full feed.
 *
 * QUERY PERSISTENCE
 *
 *   `?q=` and `?kategori=` are read on load and written with replaceState so a
 *   filtered view can be shared or reloaded. replaceState is used because a
 *   filter change must not add one history entry per keystroke.
 */

(function () {
  'use strict';

  var root = document.querySelector('[data-news-root]');
  if (!root) return;

  var controls = root.querySelector('[data-news-controls]');
  var list = root.querySelector('[data-news-list]');
  if (!controls || !list) return;

  var searchInput = controls.querySelector('[data-news-search]');
  var clearButton = controls.querySelector('[data-news-clear]');
  var resetButton = controls.querySelector('[data-news-reset]');
  var status = root.querySelector('[data-news-status]');
  var emptyPanel = root.querySelector('[data-news-empty]');
  var emptyReset = root.querySelector('[data-news-empty-reset]');
  var jsNote = root.querySelector('[data-news-js-note]');
  var staleNotice = root.querySelector('[data-news-stale]');

  var cards = Array.prototype.slice.call(list.querySelectorAll('[data-news-item]'));
  var categoryButtons = Array.prototype.slice.call(
    controls.querySelectorAll('[data-news-category]'),
  );

  if (cards.length === 0 || categoryButtons.length === 0) return;

  var total = cards.length;
  var activeCategory = 'all';
  var activeQuery = '';
  var debounceTimer = null;

  // Precompute the haystack once. The server already normalised the attribute
  // with the same rules the data layer uses for search.
  var haystacks = cards.map(function (card) {
    return (card.getAttribute('data-search') || '').toLowerCase();
  });

  function normalizeQuery(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9&]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisible(card, index) {
    if (activeCategory !== 'all' && card.getAttribute('data-category') !== activeCategory) {
      return false;
    }
    if (!activeQuery) return true;
    var haystack = haystacks[index];
    return activeQuery.split(' ').every(function (token) {
      return haystack.indexOf(token) !== -1;
    });
  }

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    var url = new URL(window.location.href);
    if (activeQuery) url.searchParams.set('q', activeQuery);
    else url.searchParams.delete('q');
    if (activeCategory !== 'all') url.searchParams.set('kategori', activeCategory);
    else url.searchParams.delete('kategori');
    window.history.replaceState(null, '', url.toString());
  }

  /**
   * The page may stay open for hours after a successful build. The build-time
   * stale notice is the no-JS baseline; this keeps the same notice honest while
   * the reader is on the page. No fetch and no network request are involved.
   */
  function syncStaleState() {
    if (!staleNotice) return;
    var generated = Date.parse(staleNotice.getAttribute('data-news-generated') || '');
    var staleHours = Number.parseFloat(
      staleNotice.getAttribute('data-news-stale-hours') || '',
    );
    if (!Number.isFinite(generated) || !Number.isFinite(staleHours) || staleHours <= 0) return;
    staleNotice.hidden = Date.now() - generated <= staleHours * 60 * 60 * 1000;
  }

  function render(options) {
    var showEmptyState = options && options.announce === false ? false : true;
    var visible = 0;

    cards.forEach(function (card, index) {
      var shown = isVisible(card, index);
      card.hidden = !shown;
      if (shown) visible += 1;
    });

    if (emptyPanel) emptyPanel.hidden = visible !== 0;
    if (list) list.hidden = visible === 0;

    if (status) {
      status.textContent =
        visible === total
          ? 'Menampilkan seluruh ' + total + ' berita.'
          : 'Menampilkan ' + visible + ' dari ' + total + ' berita.';
    }

    var hasFilter = activeCategory !== 'all' || activeQuery !== '';
    if (clearButton) clearButton.disabled = activeQuery === '';
    if (resetButton) resetButton.disabled = !hasFilter;
    if (jsNote) jsNote.hidden = true;

    if (showEmptyState) syncUrl();
  }

  function setCategory(category, options) {
    activeCategory = category;
    categoryButtons.forEach(function (button) {
      var pressed = button.getAttribute('data-news-category') === category;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    render(options);
  }

  function setQuery(value, options) {
    activeQuery = normalizeQuery(value);
    if (searchInput && searchInput.value !== value) searchInput.value = value;
    render(options);
  }

  function resetAll(options) {
    if (searchInput) searchInput.value = '';
    activeQuery = '';
    setCategory('all', options);
    if (searchInput) searchInput.focus();
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var category = button.getAttribute('data-news-category') || 'all';
      setCategory(category);
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var value = searchInput.value;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function () {
        setQuery(value);
      }, 120);
    });

    // Enter must not submit the GET form and reload the page while JS works.
    var form = searchInput.form;
    if (form) {
      form.addEventListener('submit', function (event) {
        if (event.cancelable) event.preventDefault();
        if (debounceTimer) window.clearTimeout(debounceTimer);
        setQuery(searchInput.value);
      });
    }
  }

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      setQuery('');
      if (searchInput) searchInput.focus();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', function () {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      resetAll();
    });
  }

  if (emptyReset) {
    emptyReset.addEventListener('click', function () {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      resetAll();
    });
  }

  // Initial state from the URL. A shared link restores the same view.
  var params = new URLSearchParams(window.location.search);
  var initialCategory = params.get('kategori');
  var initialQuery = params.get('q') || '';

  if (searchInput && initialQuery) searchInput.value = initialQuery;
  activeQuery = normalizeQuery(initialQuery);

  var knownCategory = categoryButtons.some(function (button) {
    return button.getAttribute('data-news-category') === initialCategory;
  });
  activeCategory = knownCategory ? initialCategory : 'all';

  categoryButtons.forEach(function (button) {
    var pressed = button.getAttribute('data-news-category') === activeCategory;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });

  render({ announce: false });
  syncStaleState();

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) syncStaleState();
  });
})();
