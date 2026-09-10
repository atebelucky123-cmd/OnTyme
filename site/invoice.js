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

// Generates the PDF, uploads it to Supabase Storage, and returns its public download URL.
export async function generateAndUploadDocument(booking, kind) {
  const bytes = await buildDocument(booking, kind);
  const bucket = kind === 'receipt' ? 'ontyme-receipts' : 'ontyme-invoices';
  const path = booking.id + '.pdf';

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// TODO once EmailJS credentials are available: call emailjs.send(serviceId,
// templateId, { to_email, download_url, booking_ref }) here, passing the URL
// returned by generateAndUploadDocument(). Not wired yet — see chat.
export async function emailDocumentLink(/* booking, kind, downloadUrl */) {
  console.warn('emailDocumentLink() is not wired up yet — needs EmailJS service/template IDs.');
}
