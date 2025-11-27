// emailService.js (Brevo API v3, siap attachment PDF)
import * as Brevo from '@getbrevo/brevo';
import dotenv from 'dotenv';
dotenv.config();

const client = new Brevo.TransactionalEmailsApi();

// Fungsi untuk hantar email
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    // Map attachment PDF ke base64
    const brevoAttachments = attachments?.map(file => ({
      content: file.content.toString('base64'),
      name: file.filename,
      type: file.mimetype || 'application/octet-stream',
    }));

    const emailData = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: brevoAttachments?.length ? brevoAttachments : undefined,
    };

    // Hantar email, pass API key setiap request
    await client.sendTransacEmail(emailData, { 'api-key': process.env.BREVO_API_KEY });

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

// Test function minimal confirm email sampai
export const testEmail = async (testRecipient) => {
  try {
    await sendEmail({
      to: testRecipient,
      subject: 'Test Email Brevo',
      html: '<h1>Hello Boss! Ini test email dari e-Approval.</h1>',
      attachments: [], // kosong untuk test
    });
    console.log('✅ Test email berjaya dihantar');
  } catch (err) {
    console.error('❌ Ralat test email:', err);
  }
};

export default sendEmail;
