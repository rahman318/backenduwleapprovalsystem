import * as Brevo from '@getbrevo/brevo';

const client = new Brevo.TransactionalEmailsApi();
client.setApiKey(process.env.BREVO_API_KEY);

const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    let brevoAttachments = [];
    if (attachments?.length) {
      brevoAttachments = attachments.map(file => ({
        content: file.content.toString('base64'),
        name: file.filename,
        type: file.mimetype || 'application/octet-stream',
      }));
    }

    const emailData = {
      sender: { name: 'e-Approval System', email: 'admin@underwaterworldlangkawi.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: brevoAttachments.length ? brevoAttachments : undefined,
    };

    await client.sendTransacEmail(emailData);

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error('❌ Ralat hantar emel:', error.response?.body || error);
  }
};

export default sendEmail;
