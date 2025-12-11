// utils/emailService.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const payload = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: [],
    };

    for (const att of attachments) {
      if (att.content) {
        payload.attachment.push({ name: att.filename, content: att.content });
      } else if (att.path) {
        const fs = await import('fs');
        const fileContent = fs.readFileSync(att.path, { encoding: 'base64' });
        payload.attachment.push({ name: att.filename, content: fileContent });
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

// ⬇️ default export
export default sendEmail;
