import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
        to: [{ email: to }],
        subject,
        htmlContent: html
      },
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
