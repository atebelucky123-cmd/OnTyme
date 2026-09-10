import { auth, db, collection, addDoc, doc, updateDoc, serverTimestamp } from './firebase.js';
import { estimateRoute, estimateRouteByCoords } from './routing.js';
import { attachAutocomplete } from './autocomplete.js';
import { calculateFare, formatNaira } from './pricing.js';
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
  btn.addEventListener('click', function () { showView('request'); });
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

// ---------- Trip type tabs ----------
var TRIP_LABELS = {
  oneway: 'One-way',
  roundtrip: 'Round trip',
  waitreturn: 'Wait & return',
  airport: 'Airport transfer'
};

var DRIVER_WHATSAPP = '2348035191966';

function buildWhatsAppLink(booking, pdfUrl) {
  var fareText = booking.fareLow && booking.fareHigh
    ? formatNaira(booking.fareLow) + ' – ' + formatNaira(booking.fareHigh)
    : 'pending';
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
  if (pdfUrl) lines.push('', 'Full request as PDF: ' + pdfUrl);
  return 'https://wa.me/' + DRIVER_WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
}

// Fallback numbers shown when a live route can't be calculated
// (address not found, OpenRouteService rate-limited, offline, etc).
var FALLBACK_ESTIMATES = {
  oneway: { distanceKm: 21.4, durationMin: 55 },
  roundtrip: { distanceKm: 21.4, durationMin: 55 },
  waitreturn: { distanceKm: 21.4, durationMin: 55 },
  airport: { distanceKm: 27, durationMin: 50 }
};

var currentTrip = 'oneway';
var currentEstimate = null; // last successful/fallback calculateFare() result
var isLiveEstimate = false;
var fareRequestToken = 0;
var currentBookingId = null;

function renderFare(result, opts) {
  opts = opts || {};
  document.getElementById('fareAmount').textContent = formatNaira(result.low) + ' – ' + formatNaira(result.high);
  var routeLabel = opts.fallback ? 'example estimate' : (opts.precise ? 'precise route' : 'live route (pick a suggestion for precision)');
  document.getElementById('fareMeta').innerHTML =
    '<span>' + result.distanceKm + ' km</span><span>·</span><span>≈ ' + result.durationMin + ' min</span><span>·</span><span>' +
    routeLabel + '</span>';
  document.getElementById('fareLines').innerHTML =
    '<div class="line"><span>Base fare</span><span>' + formatNaira(result.breakdown.base) + '</span></div>' +
    '<div class="line"><span>Distance</span><span>' + formatNaira(result.breakdown.distance) + '</span></div>' +
    '<div class="line"><span>Time</span><span>' + formatNaira(result.breakdown.time) + '</span></div>' +
    (result.breakdown.extra ? '<div class="line"><span>Trip surcharge</span><span>' + formatNaira(result.breakdown.extra) + '</span></div>' : '') +
    '<div class="line free"><span>Waiting (first 5 min)</span><span>Free</span></div>';
}

var pickupCoords = null;
var destinationCoords = null;

async function updateFareEstimate() {
  var token = ++fareRequestToken;
  var pickup = document.getElementById('pickup').value.trim();
  var destination = document.getElementById('destination').value.trim();

  document.getElementById('fareMeta').innerHTML = '<span>Calculating…</span>';

  var distanceKm, durationMin, fallback = false, precise = false;
  try {
    if (pickupCoords && destinationCoords) {
      var routeByCoords = await estimateRouteByCoords(pickupCoords, destinationCoords);
      distanceKm = routeByCoords.distanceKm;
      durationMin = routeByCoords.durationMin;
      precise = true;
    } else {
      if (!pickup || !destination) throw new Error('missing address');
      var route = await estimateRoute(pickup, destination);
      distanceKm = route.distanceKm;
      durationMin = route.durationMin;
    }
  } catch (err) {
    var fb = FALLBACK_ESTIMATES[currentTrip];
    distanceKm = fb.distanceKm;
    durationMin = fb.durationMin;
    fallback = true;
  }

  if (token !== fareRequestToken) return; // a newer request superseded this one

  var result = calculateFare({ distanceKm: distanceKm, durationMin: durationMin, tripType: currentTrip });
  currentEstimate = result;
  isLiveEstimate = !fallback;
  renderFare(result, { fallback: fallback, precise: precise });
}

var tripTabs = document.querySelectorAll('.trip-tab');
tripTabs.forEach(function (tab) {
  tab.addEventListener('click', function () {
    tripTabs.forEach(function (t) { t.classList.remove('active'); });
    tab.classList.add('active');
    currentTrip = tab.getAttribute('data-trip');
    updateFareEstimate();
  });
});

var pickupInput = document.getElementById('pickup');
var destinationInput = document.getElementById('destination');

if (pickupInput) {
  attachAutocomplete(pickupInput, function (coords) {
    pickupCoords = coords;
    updateFareEstimate();
  });
  pickupInput.addEventListener('blur', function () { setTimeout(updateFareEstimate, 200); });
}
if (destinationInput) {
  attachAutocomplete(destinationInput, function (coords) {
    destinationCoords = coords;
    updateFareEstimate();
  });
  destinationInput.addEventListener('blur', function () { setTimeout(updateFareEstimate, 200); });
}

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
requestForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  var submitBtn = requestForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  if (!currentEstimate) {
    await updateFareEstimate();
  }

  var customerName = document.getElementById('customerName').value.trim();
  var customerPhone = document.getElementById('customerPhone').value.trim();
  var customerEmail = document.getElementById('customerEmail').value.trim();
  var pickup = document.getElementById('pickup').value.trim();
  var destination = document.getElementById('destination').value.trim();
  var date = document.getElementById('date').value;
  var time = document.getElementById('time').value;
  var passengers = activeChoiceValue('passengerChoice', '2');
  var luggage = activeChoiceValue('luggageChoice', 'Small');
  var paymentMethod = activeChoiceValue('paymentChoice', 'Cash');
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
    distanceKm: estimate ? estimate.distanceKm : null,
    durationMin: estimate ? estimate.durationMin : null,
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
  document.getElementById('refFare').textContent = estimate ? (formatNaira(estimate.low) + ' – ' + formatNaira(estimate.high) + ' (estimate — driver confirms final fare)') : 'Pending driver review';

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

updateFareEstimate();
