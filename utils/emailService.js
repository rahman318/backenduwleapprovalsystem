// utils/emailService.js
import * as Brevo from '@getbrevo/brevo';
import dotenv from 'dotenv';
dotenv.config();

const client = new Brevo.TransactionalEmailsApi();

// Fungsi hantar email
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    // Convert attachments ke base64 (PDF, gambar, etc)
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

    // Pass API key setiap request (v3 wajib)
    await client.sendTransacEmail(emailData, { 'api-key': process.env.BREVO_API_KEY });

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

// Test minimal email confirm sampai inbox
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
