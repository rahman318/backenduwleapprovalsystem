import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

/**
 * sendEmail
 * @param {string} to - penerima
 * @param {string} subject - subject email
 * @param {string} html - content email
 * @param {string} [filePath] - optional attachment path (PDF)
 */
const sendEmail = async ({ to, subject, html, filePath }) => {
  try {
    const payload = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    };

    // kalau ada attachment
    if (filePath) {
      const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });
      payload.attachment = [
        {
          name: 'ApprovalRequest.pdf',
          content: fileContent
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

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
    return response.data;
  } catch (err) {
    console.error('❌ Ralat hantar emel:', err.response?.data || err.message);
  }
};

export default sendEmail;
