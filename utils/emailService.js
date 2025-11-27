import * as Brevo from '@getbrevo/brevo';

const client = new Brevo.TransactionalEmailsApi();

// Fungsi hantar email
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    // Map attachments
    const brevoAttachments = attachments?.map(file => ({
      content: file.content.toString('base64'),
      name: file.filename,
      type: file.mimetype || 'application/octet-stream',
    }));

    // Request body
    const emailData = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: brevoAttachments?.length ? brevoAttachments : undefined,
    };

    // API call → pass API key sebagai header
    await client.sendTransacEmail(emailData, { 'api-key': process.env.BREVO_API_KEY });

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

export default sendEmail;
