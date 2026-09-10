// Invoice/receipt PDF generation, entirely client-side (no backend exists in
// this project — see the architecture note in OnTyme.md).
//
// PLACEHOLDER LAYOUT: no template PNG has been supplied yet, so this draws a
// clean invoice/receipt layout from scratch using pdf-lib primitives. Once
// the real template PNG arrives, swap drawPlaceholderBackground() for
// page.drawImage(embeddedPng) and keep the same field-drawing calls on top —
// the rest of this file (Storage upload, booking wiring) does not change.
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

const BRAND = {
  chocolate: [0x4B / 255, 0x2A / 255, 0x19 / 255],
  cocoaDark: [0x2E / 255, 0x1B / 255, 0x12 / 255],
  cream: [0xF7 / 255, 0xF1 / 255, 0xE7 / 255],
  teal: [0x1D / 255, 0x6B / 255, 0x66 / 255]
};

async function buildDocument(booking, kind) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 594]); // A5-ish
  const { width, height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const color = (rgbArr) => rgb(rgbArr[0], rgbArr[1], rgbArr[2]);

  // Header band
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: color(BRAND.chocolate) });
  page.drawText('OnTyme', { x: 32, y: height - 52, size: 26, font: bold, color: color(BRAND.cream) });
  page.drawText(kind === 'receipt' ? 'RECEIPT' : 'INVOICE', {
    x: width - 32 - regular.widthOfTextAtSize(kind === 'receipt' ? 'RECEIPT' : 'INVOICE', 14),
    y: height - 45, size: 14, font: bold, color: color(BRAND.cream)
  });
  page.drawText('Scheduled private transport · Lagos', { x: 32, y: height - 72, size: 10, font: regular, color: color(BRAND.cream) });

  let y = height - 130;
  const line = (label, value, opts = {}) => {
    page.drawText(label, { x: 32, y, size: 10, font: regular, color: color(BRAND.chocolate) });
    const valueText = String(value);
    page.drawText(valueText, {
      x: width - 32 - regular.widthOfTextAtSize(valueText, opts.size || 11),
      y, size: opts.size || 11, font: opts.bold ? bold : regular, color: color(BRAND.cocoaDark)
    });
    y -= opts.gap || 22;
  };

  page.drawText('Booking reference', { x: 32, y, size: 9, font: regular, color: color(BRAND.chocolate) });
  y -= 16;
  page.drawText(booking.bookingRef || booking.id, { x: 32, y, size: 18, font: bold, color: color(BRAND.cocoaDark) });
  y -= 32;

  line('Customer', booking.customerName || '—');
  line('Phone', booking.customerPhone || '—');
  y -= 6;
  page.drawLine({ start: { x: 32, y }, end: { x: width - 32, y }, thickness: 1, color: color(BRAND.chocolate), opacity: 0.15 });
  y -= 20;

  line('Trip type', booking.tripTypeLabel || booking.tripType || '—');
  line('Pickup', booking.pickup || '—');
  line('Destination', booking.destination || '—');
  line('Date', booking.date || '—');
  line('Pickup time', booking.time || '—');
  line('Passengers', String(booking.passengers || '—'));
  line('Luggage', booking.luggage || '—');
  if (booking.distanceKm) line('Distance', booking.distanceKm + ' km');
  if (booking.durationMin) line('Duration', '~' + booking.durationMin + ' min');

  y -= 6;
  page.drawLine({ start: { x: 32, y }, end: { x: width - 32, y }, thickness: 1, color: color(BRAND.chocolate), opacity: 0.15 });
  y -= 24;

  const amount = kind === 'receipt' ? booking.agreedFare : (booking.agreedFare || booking.fareHigh);
  page.drawText(kind === 'receipt' ? 'Amount paid' : 'Estimated / agreed fare', { x: 32, y, size: 10, font: regular, color: color(BRAND.chocolate) });
  y -= 22;
  page.drawText(pdfNaira(amount || 0), { x: 32, y, size: 24, font: bold, color: color(BRAND.teal) });
  y -= 34;

  if (kind === 'receipt') {
    line('Payment method', booking.paymentMethod || 'Cash or transfer');
    line('Paid on', booking.paidOnLabel || '—');
  } else {
    page.drawText('Final fare is confirmed by the driver before the trip.', {
      x: 32, y, size: 9, font: regular, color: color(BRAND.chocolate)
    });
    y -= 30;
  }

  page.drawText('Driver: Atebe Edefo Lucky · Toyota Corolla · Lagos', { x: 32, y: 40, size: 9, font: regular, color: color(BRAND.chocolate) });
  page.drawText('Generated ' + new Date().toLocaleString('en-NG'), { x: 32, y: 26, size: 8, font: regular, color: color(BRAND.chocolate), opacity: 0.7 });

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
