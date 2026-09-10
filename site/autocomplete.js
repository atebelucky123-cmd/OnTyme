// Attaches a location-suggestions dropdown to a text input. Debounces
// keystrokes, calls OpenRouteService autocomplete, and lets the user pick a
// precise result — the coordinates from that pick are what fare estimation
// uses, instead of re-geocoding whatever text is left in the box.
import { autocomplete } from './routing.js';

export function attachAutocomplete(input, onSelect) {
  var wrap = document.createElement('div');
  wrap.className = 'autocomplete-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  var list = document.createElement('ul');
  list.className = 'autocomplete-list';
  list.hidden = true;
  wrap.appendChild(list);

  var debounceTimer = null;
  var activeIndex = -1;
  var currentResults = [];
  var selectedCoords = null;

  function clearSelection() {
    selectedCoords = null;
    onSelect(null);
  }

  function closeList() {
    list.hidden = true;
    list.innerHTML = '';
    activeIndex = -1;
  }

  function renderList(results) {
    currentResults = results;
    activeIndex = -1;
    if (!results.length) { closeList(); return; }
    list.innerHTML = results.map(function (r, i) {
      return '<li data-i="' + i + '">' + r.label + '</li>';
    }).join('');
    list.hidden = false;
  }

  function pick(i) {
    var r = currentResults[i];
    if (!r) return;
    input.value = r.label;
    selectedCoords = r.coordinates;
    closeList();
    onSelect(r.coordinates, r.label);
  }

  input.addEventListener('input', function () {
    clearSelection();
    var text = input.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async function () {
      var results = await autocomplete(text);
      if (input.value === text) renderList(results);
    }, 300);
  });

  input.addEventListener('keydown', function (e) {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) { e.preventDefault(); pick(activeIndex); }
    } else if (e.key === 'Escape') {
      closeList();
    }
  });

  function updateActive() {
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.classList.toggle('active', i === activeIndex);
    });
  }

  list.addEventListener('mousedown', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    pick(Number(li.getAttribute('data-i')));
  });

  input.addEventListener('blur', function () {
    setTimeout(closeList, 150);
  });

  return {
    getCoords: function () { return selectedCoords; }
  };
}
