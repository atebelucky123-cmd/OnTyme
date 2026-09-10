(function () {
  'use strict';

  var views = {
    home: document.getElementById('view-home'),
    request: document.getElementById('view-request'),
    confirmed: document.getElementById('view-confirmed')
  };

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle('active', key === name);
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    document.getElementById('mobileMenu').classList.remove('open');
  }

  document.querySelectorAll('[data-open-request]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showView('request');
    });
  });

  document.querySelectorAll('[data-go-home]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showView('home');
    });
  });

  // ---------- Mobile menu ----------
  var hamburgerBtn = document.getElementById('hamburgerBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      hamburgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---------- Trip type tabs ----------
  var TRIP_LABELS = {
    oneway: 'One-way',
    roundtrip: 'Round trip',
    waitreturn: 'Wait & return',
    airport: 'Airport transfer'
  };

  var FARE_PRESETS = {
    oneway: {
      amount: '₦18,500 – ₦22,000',
      distance: '21.4 km', duration: '≈ 55 min', condition: 'morning traffic',
      lines: [['Base + distance', '₦15,200'], ['Time in traffic', '₦2,400'], ['Tolls', '₦900'], ['Waiting (first 5 min)', 'Free', true]],
      agreed: '₦20,000'
    },
    roundtrip: {
      amount: '₦33,500 – ₦39,000',
      distance: '42.8 km', duration: '≈ 1 hr 50 min', condition: 'return leg included',
      lines: [['Base + distance (both legs)', '₦28,600'], ['Time in traffic', '₦4,300'], ['Tolls', '₦1,800'], ['Waiting (first 5 min)', 'Free', true]],
      agreed: '₦36,000'
    },
    waitreturn: {
      amount: '₦27,000 – ₦32,000',
      distance: '21.4 km + return', duration: 'outbound ≈ 55 min', condition: 'plus waiting time',
      lines: [['Base + distance (both legs)', '₦22,400'], ['Time in traffic', '₦3,200'], ['Tolls', '₦900'], ['Waiting (first 5 min)', 'Free', true]],
      agreed: '₦29,500'
    },
    airport: {
      amount: '₦25,000 – ₦30,000',
      distance: '≈ 27 km', duration: '≈ 50 min', condition: 'MMIA / GAT',
      lines: [['Base + distance', '₦21,000'], ['Time in traffic', '₦2,600'], ['Tolls', '₦1,900'], ['Waiting (first 5 min)', 'Free', true]],
      agreed: '₦27,500'
    }
  };

  var currentTrip = 'oneway';

  function renderFare(tripKey) {
    var preset = FARE_PRESETS[tripKey];
    document.getElementById('fareAmount').textContent = preset.amount;
    document.getElementById('fareMeta').innerHTML =
      '<span>' + preset.distance + '</span><span>·</span><span>' + preset.duration + '</span><span>·</span><span>' + preset.condition + '</span>';
    document.getElementById('fareLines').innerHTML = preset.lines.map(function (line) {
      var cls = line[2] ? ' free' : '';
      return '<div class="line' + cls + '"><span>' + line[0] + '</span><span>' + line[1] + '</span></div>';
    }).join('');
  }

  var tripTabs = document.querySelectorAll('.trip-tab');
  tripTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tripTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentTrip = tab.getAttribute('data-trip');
      renderFare(currentTrip);
    });
  });

  // ---------- Passenger / luggage choice buttons ----------
  function wireChoiceGroup(id) {
    var group = document.getElementById(id);
    if (!group) return;
    var buttons = group.querySelectorAll('.choice');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }
  wireChoiceGroup('passengerChoice');
  wireChoiceGroup('luggageChoice');

  function activeChoiceValue(id, fallback) {
    var group = document.getElementById(id);
    var active = group && group.querySelector('.choice.active');
    return active ? active.getAttribute('data-value') : fallback;
  }

  // ---------- Date default: tomorrow ----------
  var dateInput = document.getElementById('date');
  if (dateInput) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().slice(0, 10);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  function shortPlace(full) {
    return (full || '').split(',')[0].trim();
  }

  function generateBookingRef() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var n = String(Math.floor(Math.random() * 900) + 100);
    return 'OT-' + yy + mm + dd + '-' + n;
  }

  // ---------- Submit request ----------
  var requestForm = document.getElementById('requestForm');
  requestForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var pickup = document.getElementById('pickup').value;
    var destination = document.getElementById('destination').value;
    var date = document.getElementById('date').value;
    var time = document.getElementById('time').value;
    var passengers = activeChoiceValue('passengerChoice', '2');
    var luggage = activeChoiceValue('luggageChoice', 'Small');
    var preset = FARE_PRESETS[currentTrip];

    document.getElementById('confirmedHeadline').textContent =
      'Your ride is confirmed for ' + formatDate(date) + (time ? ', ' + time : '');
    document.getElementById('bookingRef').textContent = generateBookingRef();
    document.getElementById('refTrip').textContent = shortPlace(pickup) + ' → ' + shortPlace(destination);
    document.getElementById('refType').textContent = TRIP_LABELS[currentTrip];
    var luggageText = luggage === 'None' ? 'no luggage' : luggage.toLowerCase() + ' luggage';
    document.getElementById('refPassengers').textContent = passengers + ' · ' + luggageText;
    document.getElementById('refFare').textContent = preset.agreed;

    showView('confirmed');
  });

  // ---------- Cancel booking ----------
  document.querySelectorAll('[data-cancel-booking]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.confirm('Cancel this booking?')) {
        showView('home');
      }
    });
  });

  renderFare(currentTrip);
})();
