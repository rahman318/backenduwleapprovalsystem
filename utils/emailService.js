// emailService.js (Brevo API terbaru)
import Brevo from '@getbrevo/brevo';

// Initialize Brevo client
const client = new Brevo({ apiKey: process.env.BREVO_API_KEY });

// Fungsi untuk hantar email
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    // Format attachment: base64 + name + type
    let brevoAttachments = [];
    if (attachments && attachments.length > 0) {
      brevoAttachments = attachments.map(file => ({
        content: file.content.toString('base64'),
        name: file.filename,
        type: file.mimetype || 'application/octet-stream',
      }));
    }

    // Hantar email
    await client.sendTransacEmail({
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: brevoAttachments.length ? brevoAttachments : undefined,
    });

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

export default sendEmail;
