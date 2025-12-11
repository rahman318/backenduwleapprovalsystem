// utils/sendEmailWithPDF.js
import sendEmail from "./emailService.js";
import fs from "fs";
import path from "path";

/**
 * Hantar email dengan PDF attachment (kalau ada)
 * Simpan PDF ke folder `generated_pdfs` dulu
 * @param {string} to - email penerima
 * @param {string} subject - subject email
 * @param {string} html - content HTML email
 * @param {Buffer|null} pdfBuffer - buffer PDF (optional)
 * @param {string} pdfName - nama fail PDF (optional)
 */
export async function sendEmailWithPDF({ to, subject, html, pdfBuffer = null, pdfName = "attachment.pdf" }) {
  try {
    let filePath = null;

    // ✅ Simpan PDF ke disk kalau ada
    if (pdfBuffer) {
      const pdfDir = path.join(process.cwd(), "generated_pdfs");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      filePath = path.join(pdfDir, pdfName);
      fs.writeFileSync(filePath, pdfBuffer);
      console.log(`📄 PDF disimpan ke disk: ${filePath}`);
    }

    // 🔹 Siapkan data untuk hantar email
    const emailData = { to, subject, html };

    if (pdfBuffer) {
      emailData.attachment = [
        {
          name: pdfName,
          contentBase64: pdfBuffer.toString("base64"),
          type: "application/pdf"
        }
      ];
    }

    await sendEmail(emailData);

    console.log(`📨 Emel berjaya dihantar ke: ${to}${pdfBuffer ? " (PDF attached)" : ""}`);
  } catch (err) {
    console.error(`❌ Gagal hantar emel ke: ${to}`, err.message);
  }
}
