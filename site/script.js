import { auth, db, collection, addDoc, doc, updateDoc, serverTimestamp } from './firebase.js';
import { estimateRoute, estimateRouteByCoords } from './routing.js';
import { attachAutocomplete } from './autocomplete.js';
import { calculateFare, formatNaira, isAgreedPricing } from './pricing.js';
import { generateAndUploadDocument } from './invoice.js';

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
    goToStep('where');
    showView('request');
  });
});
document.querySelectorAll('[data-go-home]').forEach(function (btn) {
  btn.addEventListener('click', function () { showView('home'); });
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

// ---------- Trip type catalogue ----------
var TRIP_LABELS = {
  oneway: 'One-way',
  roundtrip: 'Round trip',
  waitreturn: 'Wait & return',
  airport: 'Airport transfer',
  hire: 'Hire (by the hour)'
};
var TRIP_PATHS = {
  oneway: 'A → B',
  roundtrip: 'A → B → A',
  waitreturn: 'A → B → wait → C',
  airport: 'MMIA / GAT',
  hire: 'Multiple stops'
};
var TRIP_DESC = {
  oneway: 'A single scheduled trip.',
  roundtrip: 'Both legs priced together.',
  waitreturn: 'First 5 minutes of waiting free.',
  airport: 'Scheduled airport pickup or drop-off.',
  hire: 'Book the driver for a set number of hours. Price agreed directly with him.'
};

var DRIVER_WHATSAPP = '2348035191966';

function buildWhatsAppLink(booking, pdfUrl) {
  var fareText = isAgreedPricing(booking.tripType)
    ? 'agreed with driver (' + booking.hireHours + 'h hire)'
    : (booking.fareLow && booking.fareHigh ? formatNaira(booking.fareLow) + ' – ' + formatNaira(booking.fareHigh) : 'pending');
  var lines = [
    'New OnTyme booking request',
    'Ref: ' + booking.bookingRef,
    'Name: ' + booking.customerName,
    'Phone: ' + booking.customerPhone,
    'Trip: ' + TRIP_LABELS[booking.tripType],
    'Pickup: ' + booking.pickup,
    'Destination: ' + booking.destination,
    'Date: ' + booking.date + ' at ' + booking.time,
    'Passengers: ' + booking.passengers + ', Luggage: ' + booking.luggage,
    'Payment: ' + booking.paymentMethod,
    'Estimated fare: ' + fareText
  ];
  if (booking.hireNotes) lines.push('Plan: ' + booking.hireNotes);
  if (pdfUrl) lines.push('', 'Full request as PDF: ' + pdfUrl);
  return 'https://wa.me/' + DRIVER_WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
}

// Fallback numbers shown when a live route can't be calculated
// (address not found, OpenRouteService rate-limited, offline, etc).
var FALLBACK_ESTIMATE = { distanceKm: 21.4, durationMin: 55 };

var currentTrip = 'oneway';
var currentEstimate = null; // calculateFare() result for the selected trip type, or null for 'hire'
var currentBookingId = null;
var pickupCoords = null;
var destinationCoords = null;
var routeInfo = null; // { distanceKm, durationMin, fallback }

// ---------- Step navigation ----------
var stepEls = {
  where: document.getElementById('stepWhereTo'),
  choose: document.getElementById('stepChooseTrip'),
  details: document.getElementById('requestForm')
};
var stepLabels = {
  where: 'Step 1 of 3 · Where to?',
  choose: 'Step 2 of 3 · Choose a trip',
  details: 'Step 3 of 3 · Trip details'
};

function goToStep(name) {
  Object.keys(stepEls).forEach(function (key) {
    stepEls[key].hidden = key !== name;
  });
  document.getElementById('requestStepLabel').textContent = stepLabels[name];
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- Step 1: where to ----------
var pickupInput = document.getElementById('pickup');
var destinationInput = document.getElementById('destination');
var toStep2Btn = document.getElementById('toStep2Btn');

function refreshStep1Button() {
  toStep2Btn.disabled = !(pickupInput.value.trim() && destinationInput.value.trim());
}

if (pickupInput) {
  attachAutocomplete(pickupInput, function (coords) { pickupCoords = coords; refreshStep1Button(); });
  pickupInput.addEventListener('input', refreshStep1Button);
}
if (destinationInput) {
  attachAutocomplete(destinationInput, function (coords) { destinationCoords = coords; refreshStep1Button(); });
  destinationInput.addEventListener('input', refreshStep1Button);
}

function shortPlace(full) {
  return (full || '').split(',')[0].trim();
}

toStep2Btn.addEventListener('click', async function () {
  toStep2Btn.disabled = true;
  toStep2Btn.textContent = 'Finding options…';

  var pickup = pickupInput.value.trim();
  var destination = destinationInput.value.trim();

  try {
    var route;
    if (pickupCoords && destinationCoords) {
      route = await estimateRouteByCoords(pickupCoords, destinationCoords);
    } else {
      route = await estimateRoute(pickup, destination);
    }
    routeInfo = { distanceKm: Math.round(route.distanceKm * 10) / 10, durationMin: Math.round(route.durationMin), fallback: false };
  } catch (err) {
    routeInfo = Object.assign({ fallback: true }, FALLBACK_ESTIMATE);
  }

  toStep2Btn.disabled = false;
  toStep2Btn.textContent = 'Find trip options';

  document.getElementById('routeSummaryText').textContent =
    shortPlace(pickup) + ' → ' + shortPlace(destination) +
    (routeInfo.fallback ? ' (example distances — could not verify this route live)' : ' · ' + routeInfo.distanceKm + ' km · ~' + routeInfo.durationMin + ' min');

  renderRideOptions();
  goToStep('choose');
});

document.getElementById('backToStep1Btn').addEventListener('click', function () { goToStep('where'); });

// ---------- Step 2: ride options ----------
function renderRideOptions() {
  var container = document.getElementById('rideOptions');
  container.innerHTML = '';

  ['oneway', 'roundtrip', 'waitreturn', 'airport', 'hire'].forEach(function (tripType) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'ride-option';
    card.setAttribute('data-trip', tripType);

    var priceHtml;
    if (tripType === 'hire') {
      priceHtml = '<span class="ride-option-price agreed">Agreed with driver</span>';
    } else {
      var result = calculateFare({ distanceKm: routeInfo.distanceKm, durationMin: routeInfo.durationMin, tripType: tripType });
      priceHtml = '<span class="ride-option-price">' + formatNaira(result.low) + ' – ' + formatNaira(result.high) + '</span>';
    }

    card.innerHTML =
      '<span class="ride-option-path">' + TRIP_PATHS[tripType] + '</span>' +
      '<span class="ride-option-title">' + TRIP_LABELS[tripType] + '</span>' +
      '<span class="ride-option-desc">' + TRIP_DESC[tripType] + '</span>' +
      priceHtml;

    card.addEventListener('click', function () { selectTrip(tripType); });
    container.appendChild(card);
  });
}

function selectTrip(tripType) {
  currentTrip = tripType;

  var fareCard = document.getElementById('fareCard');
  var agreedFareCard = document.getElementById('agreedFareCard');
  var hireFieldsRow = document.getElementById('hireFieldsRow');

  if (isAgreedPricing(tripType)) {
    currentEstimate = null;
    fareCard.hidden = true;
    agreedFareCard.hidden = false;
    hireFieldsRow.hidden = false;
  } else {
    currentEstimate = calculateFare({ distanceKm: routeInfo.distanceKm, durationMin: routeInfo.durationMin, tripType: tripType });
    renderFare(currentEstimate, { fallback: routeInfo.fallback });
    fareCard.hidden = false;
    agreedFareCard.hidden = true;
    hireFieldsRow.hidden = true;
  }

  document.getElementById('detailsHeading').textContent = TRIP_LABELS[tripType];
  document.getElementById('routeRecap').innerHTML =
    '<div class="route-track small"><span class="route-dot pickup"></span><span class="route-connector"></span><span class="route-dot dest"></span></div>' +
    '<div class="route-recap-text"><div>' + (pickupInput.value.trim() || '—') + '</div><div>' + (destinationInput.value.trim() || '—') + '</div></div>';

  goToStep('details');
}

function renderFare(result, opts) {
  opts = opts || {};
  document.getElementById('fareAmount').textContent = formatNaira(result.low) + ' – ' + formatNaira(result.high);
  document.getElementById('fareMeta').innerHTML =
    '<span>' + result.distanceKm + ' km</span><span>·</span><span>≈ ' + result.durationMin + ' min</span><span>·</span><span>' +
    (opts.fallback ? 'example estimate' : 'live route') + '</span>';
  document.getElementById('fareLines').innerHTML =
    '<div class="line"><span>Base fare</span><span>' + formatNaira(result.breakdown.base) + '</span></div>' +
    '<div class="line"><span>Distance</span><span>' + formatNaira(result.breakdown.distance) + '</span></div>' +
    '<div class="line"><span>Time</span><span>' + formatNaira(result.breakdown.time) + '</span></div>' +
    (result.breakdown.extra ? '<div class="line"><span>Trip surcharge</span><span>' + formatNaira(result.breakdown.extra) + '</span></div>' : '') +
    '<div class="line free"><span>Waiting (first 5 min)</span><span>Free</span></div>';
}

// ---------- Passenger / luggage / payment choice buttons ----------
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
wireChoiceGroup('paymentChoice');

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
requestForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  var submitBtn = requestForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  var customerName = document.getElementById('customerName').value.trim();
  var customerPhone = document.getElementById('customerPhone').value.trim();
  var customerEmail = document.getElementById('customerEmail').value.trim();
  var pickup = pickupInput.value.trim();
  var destination = destinationInput.value.trim();
  var date = document.getElementById('date').value;
  var time = document.getElementById('time').value;
  var passengers = activeChoiceValue('passengerChoice', '2');
  var luggage = activeChoiceValue('luggageChoice', 'Small');
  var paymentMethod = activeChoiceValue('paymentChoice', 'Cash');
  var isHire = isAgreedPricing(currentTrip);
  var hireHours = isHire ? Number(document.getElementById('hireHours').value) || null : null;
  var hireNotes = isHire ? document.getElementById('hireNotes').value.trim() : null;
  var bookingRef = generateBookingRef();
  var estimate = currentEstimate;

  var booking = {
    bookingRef: bookingRef,
    customerUid: auth.currentUser ? auth.currentUser.uid : null,
    customerName: customerName,
    customerPhone: customerPhone,
    customerEmail: customerEmail || null,
    pickup: pickup,
    destination: destination,
    tripType: currentTrip,
    tripTypeLabel: TRIP_LABELS[currentTrip],
    date: date,
    time: time,
    passengers: passengers,
    luggage: luggage,
    paymentMethod: paymentMethod,
    hireHours: hireHours,
    hireNotes: hireNotes || null,
    distanceKm: estimate ? estimate.distanceKm : (routeInfo ? routeInfo.distanceKm : null),
    durationMin: estimate ? estimate.durationMin : (routeInfo ? routeInfo.durationMin : null),
    fareLow: estimate ? estimate.low : null,
    fareHigh: estimate ? estimate.high : null,
    breakdown: estimate ? estimate.breakdown : null,
    agreedFare: null,
    status: 'REQUESTED',
    paid: false,
    createdAt: serverTimestamp()
  };

  var docRef;
  try {
    docRef = await addDoc(collection(db, 'bookings'), booking);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit request';
    alert('Could not submit your request: ' + err.message);
    return;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit request';
  currentBookingId = docRef.id;

  document.getElementById('confirmedHeadline').textContent =
    'Your request has been sent for ' + formatDate(date) + (time ? ', ' + time : '');
  document.getElementById('bookingRef').textContent = bookingRef;
  document.getElementById('refTrip').textContent = shortPlace(pickup) + ' → ' + shortPlace(destination);
  document.getElementById('refType').textContent = TRIP_LABELS[currentTrip];
  var luggageText = luggage === 'None' ? 'no luggage' : luggage.toLowerCase() + ' luggage';
  document.getElementById('refPassengers').textContent = passengers + ' · ' + luggageText;
  document.getElementById('refPayment').textContent = paymentMethod;
  document.getElementById('refFare').textContent = isHire
    ? 'Agreed with driver (' + hireHours + 'h hire)'
    : (estimate ? (formatNaira(estimate.low) + ' – ' + formatNaira(estimate.high) + ' (estimate — driver confirms final fare)') : 'Pending driver review');

  var whatsappBtn = document.getElementById('whatsappNotifyBtn');
  var bookingWithId = Object.assign({ id: docRef.id }, booking);
  whatsappBtn.href = buildWhatsAppLink(booking);

  showView('confirmed');

  // Attach a link to a nicely formatted PDF of the request instead of
  // leaving the driver with plain text only. Non-blocking: if it fails or
  // is slow, the WhatsApp button above already works with the text-only link.
  var originalLabel = whatsappBtn.textContent;
  whatsappBtn.textContent = 'Preparing WhatsApp message…';
  generateAndUploadDocument(bookingWithId, 'invoice').then(function (pdfUrl) {
    whatsappBtn.href = buildWhatsAppLink(booking, pdfUrl);
    whatsappBtn.textContent = originalLabel;
  }).catch(function (err) {
    console.error('Could not attach a PDF link to the WhatsApp message:', err);
    whatsappBtn.textContent = originalLabel;
  });
});

// ---------- Cancel booking ----------
document.querySelectorAll('[data-cancel-booking]').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    if (!window.confirm('Cancel this request?')) return;
    if (currentBookingId) {
      try {
        await updateDoc(doc(db, 'bookings', currentBookingId), { status: 'CANCELLED', cancelledAt: serverTimestamp() });
      } catch (err) {
        console.error(err);
      }
    }
    showView('home');
  });
});
