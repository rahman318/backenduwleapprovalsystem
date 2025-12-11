// utils/emailService.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Hantar email, boleh attach PDF dari buffer terus
 * @param {string} to - penerima
 * @param {string} subject - subject email
 * @param {string} html - content email
 * @param {Buffer|null} pdfBuffer - optional PDF buffer
 * @param {string} pdfName - nama fail PDF
 */
const sendEmail = async ({ to, subject, html, pdfBuffer = null, pdfName = 'attachment.pdf' }) => {
  try {
    const payload = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    // Kalau ada PDF buffer, attach terus
    if (pdfBuffer) {
      payload.attachment = [
        {
          name: pdfName,
          contentBase64: pdfBuffer.toString('base64'),
          type: 'application/pdf',
        }
      ];
    }

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Emel berjaya dihantar kepada: ${to}${pdfBuffer ? ' (PDF attached)' : ''}`);
    return response.data;

  } catch (err) {
    console.error('❌ Ralat hantar emel:', err.response?.data || err.message);
  }
};

export default sendEmail;

