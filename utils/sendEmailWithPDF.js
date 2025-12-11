// utils/sendEmailWithPDF.js
import sendEmail from "./emailService.js";

/**
 * Hantar email dengan PDF attachment (kalau ada)
 * @param {string} to - email penerima
 * @param {string} subject - subject email
 * @param {string} html - content HTML email
 * @param {Buffer|null} pdfBuffer - buffer PDF (optional)
 * @param {string} pdfName - nama fail PDF (optional)
 */
export async function sendEmailWithPDF({ to, subject, html, pdfBuffer = null, pdfName = "attachment.pdf" }) {
  try {
    await sendEmail({
      to,
      subject,
      html,
      pdfBuffer: pdfBuffer || undefined,
      pdfName: pdfBuffer ? pdfName : undefined,
    });
    console.log(`📨 Emel berjaya dihantar ke: ${to}${pdfBuffer ? " (PDF attached)" : ""}`);
  } catch (err) {
    console.error(`❌ Gagal hantar emel ke: ${to}`, err.message);
  }
}
