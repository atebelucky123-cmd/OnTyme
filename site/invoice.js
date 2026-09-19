// Invoice/receipt PDF generation, entirely client-side (no backend exists in
// this project — see the architecture note in OnTyme.md). Drawn from scratch
// with pdf-lib, styled after Uber/Bolt trip receipts: a big total up top, a
// simple route timeline, an itemized fare breakdown, then the record-keeping
// details (booking ref, customer, driver).
//
// Requires the pdf-lib and supabase-js UMD builds to be loaded on the page first:
//   <script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
import { supabase } from './supabase.js';
import { db, doc, setDoc, serverTimestamp } from './firebase.js';
import { formatNaira } from './pricing.js';

// pdf-lib's standard fonts (Helvetica etc.) only support WinAnsi encoding,
// which has no glyph for ₦ or ≈ — swap them for PDF-safe equivalents.
// (formatNaira() itself still uses ₦ for on-screen HTML, which renders it fine.)
function pdfNaira(amount) {
  return formatNaira(amount).replace('₦', 'NGN ');
}

const PAGE_W = 380;
const PAGE_H = 900;
const MARGIN = 32;

const CHOCOLATE = [0x4b / 255, 0x2a / 255, 0x19 / 255];
const COCOA_DARK = [0x2e / 255, 0x1b / 255, 0x12 / 255];
const COCOA_500 = [0x6e / 255, 0x44 / 255, 0x29 / 255];
const CREAM_200 = [0xef / 255, 0xe5 / 255, 0xd6 / 255];
const TEAL = [0x1d / 255, 0x6b / 255, 0x66 / 255];
const TEAL_DARK = [0x12 / 255, 0x3f / 255, 0x3c / 255];
const CONFIRMED_BG = [0xe3 / 255, 0xee / 255, 0xec / 255];
const PENDING_BG = [0xf6 / 255, 0xe7 / 255, 0xcf / 255];
const PENDING_FG = [0x7a / 255, 0x4e / 255, 0x14 / 255];
const HAIRLINE = [0x2e / 255, 0x1b / 255, 0x12 / 255];

async function fetchBytes(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Could not load ' + path);
  return res.arrayBuffer();
}

async function buildDocument(booking, kind) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const c = (rgbArr) => rgb(rgbArr[0], rgbArr[1], rgbArr[2]);

  const iconBytes = await fetchBytes('./assets/favicon.png');
  const icon = await pdfDoc.embedPng(iconBytes);

  let y = PAGE_H - MARGIN;
  const innerW = PAGE_W - MARGIN * 2;

  const text = (str, x, yPos, opts = {}) => {
    page.drawText(String(str), {
      x, y: yPos, size: opts.size || 11, font: opts.font || regular,
      color: c(opts.color || COCOA_DARK)
    });
  };
  const centeredText = (str, yPos, opts = {}) => {
    const size = opts.size || 11;
    const font = opts.font || regular;
    const w = font.widthOfTextAtSize(String(str), size);
    text(str, (PAGE_W - w) / 2, yPos, opts);
  };
  const rightText = (str, rightX, yPos, opts = {}) => {
    const size = opts.size || 11;
    const font = opts.font || regular;
    const w = font.widthOfTextAtSize(String(str), size);
    text(str, rightX - w, yPos, opts);
  };
  const hr = (yPos, opts = {}) => {
    page.drawLine({
      start: { x: MARGIN, y: yPos }, end: { x: PAGE_W - MARGIN, y: yPos },
      thickness: 1, color: c(HAIRLINE), opacity: opts.opacity || 0.12
    });
  };
  const pill = (label, xCenter, yPos, bg, fg) => {
    const size = 9;
    const w = bold.widthOfTextAtSize(label, size) + 20;
    const h = 18;
    page.drawRectangle({ x: xCenter - w / 2, y: yPos, width: w, height: h, color: c(bg) });
    text(label, xCenter - bold.widthOfTextAtSize(label, size) / 2, yPos + 6, { size, font: bold, color: fg });
  };

  // ---- Header: icon + wordmark + tagline ----
  const iconSize = 34;
  const headerBlockW = iconSize + 8 + bold.widthOfTextAtSize('OnTyme', 22);
  let hx = (PAGE_W - headerBlockW) / 2;
  page.drawImage(icon, { x: hx, y: y - iconSize + 4, width: iconSize, height: iconSize });
  text('OnTyme', hx + iconSize + 8, y - iconSize + 12, { size: 22, font: bold, color: CHOCOLATE });
  y -= iconSize + 8;
  centeredText('For Busy People.', y, { size: 10, font: italic, color: COCOA_500 });
  y -= 26;
  hr(y);
  y -= 28;

  // ---- Kind label + status pill ----
  centeredText(kind === 'receipt' ? 'TRIP RECEIPT' : 'TRIP INVOICE', y, { size: 11, font: bold, color: COCOA_500 });
  y -= 24;
  if (kind === 'receipt') {
    pill('PAID', PAGE_W / 2, y - 18, CONFIRMED_BG, TEAL_DARK);
  } else {
    pill('AWAITING PAYMENT', PAGE_W / 2, y - 18, PENDING_BG, PENDING_FG);
  }
  y -= 46;

  // ---- Big total ----
  const amount = kind === 'receipt' ? (booking.agreedFare || 0) : (booking.agreedFare || booking.fareHigh || 0);
  centeredText(kind === 'receipt' ? 'Total paid' : (booking.agreedFare ? 'Agreed fare' : 'Estimated fare'), y, { size: 10, color: COCOA_500 });
  y -= 30;
  centeredText(pdfNaira(amount), y, { size: 32, font: bold, color: kind === 'receipt' ? TEAL : CHOCOLATE });
  y -= 34;
  hr(y);
  y -= 28;

  // ---- Route timeline ----
  const dotX = MARGIN + 4;
  const textX = dotX + 18;
  page.drawCircle({ x: dotX, y: y - 4, size: 4, color: c(CHOCOLATE) });
  text('PICKUP', textX, y, { size: 8, font: bold, color: COCOA_500 });
  text(booking.pickup || '—', textX, y - 13, { size: 11, color: COCOA_DARK, font: regular });
  y -= 34;
  for (let i = 0; i < 3; i++) {
    page.drawCircle({ x: dotX, y: y - i * 6, size: 0.8, color: c(COCOA_500), opacity: 0.5 });
  }
  y -= 20;
  page.drawCircle({ x: dotX, y: y - 4, size: 4, color: c(TEAL) });
  text('DESTINATION', textX, y, { size: 8, font: bold, color: COCOA_500 });
  text(booking.destination || '—', textX, y - 13, { size: 11, color: COCOA_DARK, font: regular });
  y -= 30;
  text((booking.date || '—') + '  ·  ' + (booking.time || '—') + (booking.distanceKm ? '  ·  ' + booking.distanceKm + ' km' : '') + (booking.durationMin ? '  ·  ~' + booking.durationMin + ' min' : ''), MARGIN, y, { size: 9.5, color: COCOA_500 });
  y -= 22;
  hr(y);
  y -= 26;

  // ---- Trip details grid ----
  const col2 = MARGIN + innerW / 2;
  const gridField = (label, value, x, yPos) => {
    text(label, x, yPos, { size: 8, font: bold, color: COCOA_500 });
    text(value == null || value === '' ? '—' : String(value), x, yPos - 13, { size: 11, color: COCOA_DARK });
  };
  gridField('TRIP TYPE', booking.tripTypeLabel || booking.tripType, MARGIN, y);
  gridField('PASSENGERS', booking.passengers, col2, y);
  y -= 36;
  gridField('LUGGAGE', booking.luggage, MARGIN, y);
  gridField('PAYMENT', booking.paymentMethod || 'Cash / transfer', col2, y);
  y -= 30;
  hr(y);
  y -= 26;

  // ---- Fare breakdown ----
  text('FARE BREAKDOWN', MARGIN, y, { size: 8, font: bold, color: COCOA_500 });
  y -= 20;
  const row = (label, value, opts = {}) => {
    text(label, MARGIN, y, { size: opts.size || 11, font: opts.font || regular, color: opts.color || COCOA_DARK });
    rightText(value, PAGE_W - MARGIN, y, { size: opts.size || 11, font: opts.font || regular, color: opts.color || COCOA_DARK });
    y -= opts.gap || 22;
  };
  if (booking.breakdown) {
    if (booking.breakdown.base != null) row('Base fare', pdfNaira(booking.breakdown.base));
    if (booking.breakdown.distance != null) row('Distance', pdfNaira(booking.breakdown.distance));
    if (booking.breakdown.time != null) row('Time', pdfNaira(booking.breakdown.time));
    if (booking.breakdown.extra) row('Trip surcharge', pdfNaira(booking.breakdown.extra));
  } else {
    row(kind === 'receipt' ? 'Trip fare' : 'Estimated fare', pdfNaira(amount));
  }
  y -= 2;
  hr(y);
  y -= 22;
  row(kind === 'receipt' ? 'Total paid' : 'Total', pdfNaira(amount), { size: 13, font: bold, color: kind === 'receipt' ? TEAL_DARK : CHOCOLATE, gap: 26 });
  y -= 4;
  hr(y);
  y -= 30;

  // ---- Booking reference ----
  centeredText('BOOKING REFERENCE', y, { size: 8, font: bold, color: COCOA_500 });
  y -= 20;
  centeredText(booking.bookingRef || booking.id, y, { size: 18, font: bold, color: COCOA_DARK });
  y -= 32;
  hr(y);
  y -= 26;

  // ---- Customer / driver ----
  gridField('CUSTOMER', booking.customerName, MARGIN, y);
  gridField('PHONE', booking.customerPhone, col2, y);
  y -= 36;
  if (booking.customerEmail) {
    gridField('EMAIL', booking.customerEmail, MARGIN, y);
  }
  gridField('DRIVER', 'Atebe Edefo Lucky', col2, y);
  y -= 40;

  centeredText('Toyota Corolla · Lagos · Final fare confirmed by the driver.', y, { size: 8.5, color: COCOA_500 });
  y -= 16;
  centeredText('Questions? WhatsApp +234 803 519 1966', y, { size: 8.5, color: COCOA_500 });
  y -= 20;
  centeredText('Thank you for choosing OnTyme.', y, { size: 10, font: italic, color: CHOCOLATE });

  return pdfDoc.save();
}

// A printed-ticket style receipt (address/phone/email header, blank-line
// fields, signature lines at the bottom) — a distinct visual template from
// buildDocument()'s app-style receipt, for drivers who want something that
// looks like a physical trip ticket to hand or email to a walk-in customer.
async function buildTicketDocument(data) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const W = 380, H = 590, M = 26;
  const page = pdfDoc.addPage([W, H]);

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const c = (rgbArr) => rgb(rgbArr[0], rgbArr[1], rgbArr[2]);

  const iconBytes = await fetchBytes('./assets/favicon.png');
  const icon = await pdfDoc.embedPng(iconBytes);

  const text = (str, x, yPos, opts = {}) => {
    page.drawText(String(str), {
      x, y: yPos, size: opts.size || 11, font: opts.font || regular,
      color: c(opts.color || COCOA_DARK)
    });
  };
  const rightText = (str, rightX, yPos, opts = {}) => {
    const size = opts.size || 11;
    const font = opts.font || regular;
    const w = font.widthOfTextAtSize(String(str), size);
    text(str, rightX - w, yPos, opts);
  };
  const line = (yPos, opts = {}) => {
    page.drawLine({
      start: { x: M, y: yPos }, end: { x: W - M, y: yPos },
      thickness: opts.thickness || 0.7, color: c(HAIRLINE), opacity: opts.opacity || 0.15
    });
  };

  // Ticket border, echoing a physical paper ticket
  page.drawRectangle({ x: 10, y: 10, width: W - 20, height: H - 20, borderColor: c(HAIRLINE), borderWidth: 1.2, borderOpacity: 0.35 });

  let y = H - M - 8;

  const iconSize = 26;
  page.drawImage(icon, { x: M, y: y - iconSize + 6, width: iconSize, height: iconSize });
  text('OnTyme', M + iconSize + 8, y - iconSize + 14, { size: 17, font: bold, color: CHOCOLATE });
  rightText('TRIP TICKET', W - M, y - 6, { size: 10, font: bold, color: TEAL_DARK });
  y -= iconSize + 16;

  text('Address: ' + (data.companyAddress || 'Lagos, Nigeria'), M, y, { size: 8.5, color: COCOA_500 });
  y -= 13;
  text('Phone: ' + (data.companyPhone || '—'), M, y, { size: 8.5, color: COCOA_500 });
  y -= 13;
  text('Email: ' + (data.companyEmail || '—'), M, y, { size: 8.5, color: COCOA_500 });
  y -= 18;
  line(y);
  y -= 22;

  text('Ref: ' + data.bookingRef, M, y, { size: 9, font: bold, color: COCOA_500 });
  y -= 28;

  const fieldRow = (label, value) => {
    text(label.toUpperCase(), M, y, { size: 8, font: bold, color: COCOA_500 });
    y -= 15;
    text(value || '—', M, y, { size: 12.5, color: COCOA_DARK });
    y -= 10;
    line(y);
    y -= 20;
  };
  const twoCol = (labelA, valueA, labelB, valueB) => {
    const colX = M + (W - M * 2) / 2 + 8;
    text(labelA.toUpperCase(), M, y, { size: 8, font: bold, color: COCOA_500 });
    text(labelB.toUpperCase(), colX, y, { size: 8, font: bold, color: COCOA_500 });
    y -= 15;
    text(valueA || '—', M, y, { size: 12.5, color: COCOA_DARK });
    text(valueB || '—', colX, y, { size: 12.5, color: COCOA_DARK });
    y -= 10;
    line(y);
    y -= 20;
  };

  twoCol('Date', data.date, 'Time', data.time);
  fieldRow("Passenger's name", data.customerName);
  fieldRow('Phone no.', data.customerPhone);
  fieldRow("Passenger's email", data.customerEmail);
  fieldRow("Driver's name", data.driverName);
  fieldRow('Pickup location', data.pickup);
  fieldRow('Destination', data.destination);

  text('AMOUNT PAID', M, y, { size: 8, font: bold, color: COCOA_500 });
  y -= 24;
  text(pdfNaira(data.agreedFare), M, y, { size: 22, font: bold, color: TEAL_DARK });
  y -= 26;
  line(y, { thickness: 1, opacity: 0.2 });
  y -= 34;

  const sigW = (W - M * 2 - 24) / 2;
  page.drawLine({ start: { x: M, y }, end: { x: M + sigW, y }, thickness: 1, color: c(HAIRLINE), opacity: 0.4 });
  page.drawLine({ start: { x: M + sigW + 24, y }, end: { x: W - M, y }, thickness: 1, color: c(HAIRLINE), opacity: 0.4 });
  y -= 12;
  text("Passenger's signature / date", M, y, { size: 7.5, color: COCOA_500 });
  text('Driver / vendor signature', M + sigW + 24, y, { size: 7.5, color: COCOA_500 });

  return pdfDoc.save();
}

// A4 print sheet holding two identical BLANK ticket panels (labels only, no
// data) stacked with a cut line between them — meant to be bulk-printed as
// paper stock that the driver fills in by hand at the moment a ticket is
// issued, since one sheet gets printed many times over. PDF page geometry is
// physical points (1/72"), not pixels, so true A4 (595.28 x 841.89pt) prints
// at the correct real-world size regardless of screen DPI.
async function buildBlankTicketSheet(companyInfo) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const PAGE = [595.28, 841.89];
  const page = pdfDoc.addPage(PAGE);
  const [W, H] = PAGE;
  const M = 24;

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const c = (rgbArr) => rgb(rgbArr[0], rgbArr[1], rgbArr[2]);

  const iconBytes = await fetchBytes('./assets/favicon.png');
  const icon = await pdfDoc.embedPng(iconBytes);

  const gap = 24;
  const panelH = (H - M * 2 - gap) / 2;
  const panelTops = [H - M, H - M - panelH - gap];

  function drawPanel(top) {
    const innerW = W - M * 2;
    page.drawRectangle({ x: M, y: top - panelH, width: innerW, height: panelH, borderColor: c(HAIRLINE), borderWidth: 1.2, borderOpacity: 0.35 });

    let y = top - 16;
    const text = (str, x, yPos, opts = {}) => {
      page.drawText(String(str), { x, y: yPos, size: opts.size || 9, font: opts.font || regular, color: c(opts.color || COCOA_DARK) });
    };
    const rightText = (str, rightX, yPos, opts = {}) => {
      const size = opts.size || 9; const font = opts.font || regular;
      const w = font.widthOfTextAtSize(String(str), size);
      text(str, rightX - w, yPos, opts);
    };
    const blankRow = (label, xStart, xEnd, yPos) => {
      text(label, xStart, yPos, { size: 8.5, font: bold, color: COCOA_500 });
      const labelW = bold.widthOfTextAtSize(label, 8.5) + 6;
      page.drawLine({ start: { x: xStart + labelW, y: yPos - 2 }, end: { x: xEnd, y: yPos - 2 }, thickness: 0.7, color: c(HAIRLINE), opacity: 0.5 });
    };
    // For fields that tend to run long when handwritten (addresses) — a
    // labelled first line plus a second, unlabelled blank line beneath it.
    const blankRowTwoLines = (label, xStart, xEnd, yPos) => {
      blankRow(label, xStart, xEnd, yPos);
      page.drawLine({ start: { x: xStart, y: yPos - 2 - 15 }, end: { x: xEnd, y: yPos - 2 - 15 }, thickness: 0.7, color: c(HAIRLINE), opacity: 0.5 });
    };

    const iconSize = 20;
    page.drawImage(icon, { x: M + 14, y: y - iconSize + 5, width: iconSize, height: iconSize });
    text('OnTyme', M + 14 + iconSize + 8, y - iconSize + 12, { size: 14, font: bold, color: CHOCOLATE });
    rightText('TRIP TICKET', W - M - 14, y - 5, { size: 9, font: bold, color: TEAL_DARK });
    y -= iconSize + 12;

    text('Address: Lagos, Nigeria', M + 14, y, { size: 8, color: COCOA_500 });
    y -= 10;
    text('Phone: ' + (companyInfo.companyPhone || '—'), M + 14, y, { size: 8, color: COCOA_500 });
    y -= 10;
    text('Email: ' + (companyInfo.companyEmail || '—'), M + 14, y, { size: 8, color: COCOA_500 });
    y -= 14;

    const midX = M + 14 + (innerW - 28) / 2 + 8;
    const rightEdge = W - M - 14;
    const rowGap = 24;

    blankRow('REF NO.', M + 14, rightEdge, y);
    y -= rowGap;
    blankRow('DATE', M + 14, midX - 8, y);
    blankRow('TIME', midX, rightEdge, y);
    y -= rowGap;
    blankRow("PASSENGER'S NAME", M + 14, rightEdge, y);
    y -= rowGap;
    blankRow("PASSENGER'S EMAIL", M + 14, rightEdge, y);
    y -= rowGap;
    blankRow('PHONE NO.', M + 14, rightEdge, y);
    y -= rowGap;
    blankRow("DRIVER'S NAME", M + 14, rightEdge, y);
    y -= rowGap;
    blankRowTwoLines('PICKUP LOCATION', M + 14, rightEdge, y);
    y -= rowGap + 15;
    blankRowTwoLines('DESTINATION', M + 14, rightEdge, y);
    y -= rowGap + 15;
    blankRow('AMOUNT PAID (NGN)', M + 14, rightEdge, y);

    // Signatures anchor to the bottom of the panel rather than trailing
    // right after the fields, however much or little room that leaves.
    const sigW = (innerW - 28 - 24) / 2;
    const sigY = top - panelH + 34;
    page.drawLine({ start: { x: M + 14, y: sigY }, end: { x: M + 14 + sigW, y: sigY }, thickness: 1, color: c(HAIRLINE), opacity: 0.4 });
    page.drawLine({ start: { x: M + 14 + sigW + 24, y: sigY }, end: { x: rightEdge, y: sigY }, thickness: 1, color: c(HAIRLINE), opacity: 0.4 });
    text("Passenger's signature / date", M + 14, sigY - 11, { size: 7, color: COCOA_500 });
    text('Driver / vendor signature', M + 14 + sigW + 24, sigY - 11, { size: 7, color: COCOA_500 });
  }

  drawPanel(panelTops[0]);
  drawPanel(panelTops[1]);

  const cutY = panelTops[1] + gap / 2;
  for (let x = M; x < W - M; x += 10) {
    page.drawLine({ start: { x, y: cutY }, end: { x: Math.min(x + 5, W - M), y: cutY }, thickness: 0.75, color: c(HAIRLINE), opacity: 0.5 });
  }

  return pdfDoc.save();
}

// Builds the blank print sheet and triggers a browser download directly —
// unlike the other documents, this one isn't tied to a transaction, so there's
// nothing to upload to Supabase or index in Firestore.
export async function buildAndDownloadBlankTicketSheet(companyInfo) {
  const bytes = await buildBlankTicketSheet(companyInfo || {});
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'OnTyme Blank Tickets (A4).pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

// Generates the PDF, uploads it to Supabase Storage, and returns its public download URL.
export async function generateAndUploadDocument(booking, kind) {
  const bytes = kind === 'ticket' ? await buildTicketDocument(booking) : await buildDocument(booking, kind);
  const bucket = kind === 'invoice' ? 'ontyme-invoices' : 'ontyme-receipts';
  // Storage path stays keyed on the booking id (guaranteed unique, avoids
  // overwrites) — the friendly name below is only what the browser shows
  // when someone downloads it, set via Supabase's `download` option.
  const path = booking.id + '.pdf';
  const label = kind === 'invoice' ? 'Invoice' : (kind === 'ticket' ? 'Ticket' : 'Receipt');
  const dateLabel = booking.date || new Date().toISOString().slice(0, 10);
  const downloadName = 'OnTyme ' + label + ' (' + dateLabel + ').pdf';

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path, { download: downloadName });
  const url = data.publicUrl;

  // Index this document so the driver console's "Receipts & Invoices" screen
  // can list and search it later — this is the only durable record a manual
  // (no-booking) receipt ever gets, so it has to happen here, not just be
  // left to the Firestore booking doc for real bookings.
  try {
    await setDoc(doc(db, 'documents', booking.id + '_' + kind), {
      kind: kind,
      bookingId: booking.id,
      bookingRef: booking.bookingRef || booking.id,
      customerName: booking.customerName || null,
      customerPhone: booking.customerPhone || null,
      pickup: booking.pickup || null,
      destination: booking.destination || null,
      date: booking.date || null,
      amount: kind === 'receipt' ? (booking.agreedFare || null) : (booking.agreedFare || booking.fareHigh || null),
      url: url,
      manual: booking.id.indexOf('manual-') === 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('Could not index document for search:', err);
  }

  return url;
}

// EmailJS free tier doesn't support attachments, so this emails a link to
// the PDF (already uploaded to Supabase Storage) rather than the file
// itself. Requires the EmailJS UMD build loaded on the page first:
//   <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
const EMAILJS_PUBLIC_KEY = 'Jv3M9WbYvsxsOmP9O';
const EMAILJS_SERVICE_ID = 'service_bt9lwzj';
const EMAILJS_TEMPLATE_ID = 'template_ytqtxi7';

let emailjsReady = false;
function ensureEmailJsInit() {
  if (!emailjsReady) {
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    emailjsReady = true;
  }
}

// Emails a link to an already-generated invoice/receipt PDF to the
// customer. Silently does nothing if they didn't give an email at booking
// time — this is a nice-to-have on top of the WhatsApp notification and the
// in-app download, not the only way to get the document.
export async function emailDocumentLink(booking, kind, downloadUrl, overrideEmail) {
  const toEmail = overrideEmail || booking.customerEmail;
  if (!toEmail) return;
  ensureEmailJsInit();

  const amount = kind === 'receipt' ? (booking.agreedFare || 0) : (booking.agreedFare || booking.fareHigh || 0);

  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: toEmail,
    customer_name: booking.customerName || 'there',
    doc_type: kind === 'receipt' ? 'Receipt' : (kind === 'ticket' ? 'Ticket' : 'Invoice'),
    booking_ref: booking.bookingRef || booking.id,
    pickup: booking.pickup || '',
    destination: booking.destination || '',
    date: booking.date || '',
    time: booking.time || '',
    amount: pdfNaira(amount),
    download_url: downloadUrl,
    driver_name: 'Atebe Edefo Lucky',
    driver_phone: '+234 803 519 1966'
  });
}
