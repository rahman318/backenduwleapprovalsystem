// emailService.js (Brevo API version)
import Brevo from '@getbrevo/brevo';

// Initialize Brevo client
const client = new Brevo.ApiClient();
client.setApiKey(Brevo.ApiClient.API_KEY, process.env.BREVO_API_KEY);

const emailApi = new Brevo.TransactionalEmailsApi(client);

// Fungsi untuk hantar email
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    // Brevo attachment format: base64 + name + contentType
    let brevoAttachments = [];
    if (attachments && attachments.length > 0) {
      brevoAttachments = attachments.map(file => ({
        content: file.content.toString('base64'), // PDF buffer → base64
        name: file.filename,
        type: file.mimetype || 'application/octet-stream',
      }));
    }

    const sendSmtpEmail = new Brevo.SendSmtpEmail({
      to: [{ email: to }],
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      subject,
      htmlContent: html,
      attachment: brevoAttachments,
    });

    await emailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

export default sendEmail;

