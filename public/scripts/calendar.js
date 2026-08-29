/**
 * Calendar filter — pure enhancement, no-JS-safe.
 *
 * Authority: user instruction (AXIORA Market Calendar feature), static-first rule.
 *
 * The full calendar is pre-rendered server-side, so with JavaScript unavailable
 * every event is visible. This script only narrows what is already on the page by
 * toggling the `hidden` attribute on event groups and whole day tables. It adds no
 * content and removes nothing from the document; disabling it leaves a complete page.
 *
 * Wired with `is:inline` + a static file in /public/scripts so the emitted filename
 * stays auditable and matches an entry in verify-static.mjs APPROVED_SCRIPTS.
 */
(function () {
  'use strict';

  var form = document.querySelector('[data-calendar-filters]');
  if (!form) return;

  var dateSel = form.querySelector('[data-filter="date"]');
  var currencySel = form.querySelector('[data-filter="currency"]');
  var impactSel = form.querySelector('[data-filter="impact"]');
  var emptyNote = document.querySelector('[data-calendar-empty]');
  var tables = Array.prototype.slice.call(document.querySelectorAll('[data-calendar-table]'));

  function apply() {
    var dateValue = dateSel ? dateSel.value : 'all';
    var currencyValue = currencySel ? currencySel.value : 'all';
    var impactValue = impactSel ? impactSel.value : 'all';

    var anyVisible = false;

    tables.forEach(function (table) {
      var dateMatch = dateValue === 'all' || table.getAttribute('data-date') === dateValue;

      var events = Array.prototype.slice.call(
        table.querySelectorAll('[data-calendar-event]'),
      );

      var tableHasVisible = false;
      events.forEach(function (event) {
        var currencyMatch =
          currencyValue === 'all' || event.getAttribute('data-currency') === currencyValue;
        var impactMatch =
          impactValue === 'all' || event.getAttribute('data-impact') === impactValue;
        var show = dateMatch && currencyMatch && impactMatch;
        event.hidden = !show;
        if (show) tableHasVisible = true;
      });

      // Hide a whole day table when its date is filtered out or no row matches.
      table.hidden = !(dateMatch && tableHasVisible);
      if (dateMatch && tableHasVisible) anyVisible = true;
    });

    if (emptyNote) emptyNote.hidden = anyVisible;
  }

  [dateSel, currencySel, impactSel].forEach(function (control) {
    if (control) control.addEventListener('change', apply);
  });

  apply();
})();
