import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * sendEmail
 * @param {string} to - penerima
 * @param {string} subject - subject email
 * @param {string} html - content email
 * @param {Array} attachments - optional, [{ filename, path }] atau [{ filename, content (Base64) }]
 */
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const payload = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: [],
    };

    // Proses attachments
    for (const att of attachments) {
      if (att.content) {
        // kalau ada buffer Base64
        payload.attachment.push({
          name: att.filename,
          content: att.content,
        });
      } else if (att.path) {
        // kalau ada path file, convert ke Base64
        const fs = await import('fs');
        const fileContent = fs.readFileSync(att.path, { encoding: 'base64' });
        payload.attachment.push({
          name: att.filename,
          content: fileContent,
        });
      }
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

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
    return response.data;
  } catch (err) {
    console.error('❌ Ralat hantar emel:', err.response?.data || err.message);
    throw err;
  }
};

export { sendEmail };
