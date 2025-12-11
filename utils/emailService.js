// utils/emailService.js
import Brevo from "@getbrevo/brevo";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendEmail via Brevo SDK
 * @param {Object} options
 * @param {string} options.to - penerima email
 * @param {string} options.subject - subject email
 * @param {string} options.html - content HTML email
 * @param {Buffer} [options.pdfBuffer] - optional PDF buffer
 * @param {string} [options.pdfName] - nama PDF attachment
 */
async function sendEmail({ to, subject, html, pdfBuffer, pdfName }) {
  try {
    // 🟢 setup Brevo client
    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    // 🟢 prepare email
    const sendSmtpEmail = {
      to: [{ email: to }],
      sender: { email: "noreply@yourcompany.com", name: "e-Approval System" },
      subject,
      htmlContent: html,
    };

    // 🟢 attach PDF kalau ada
    if (pdfBuffer) {
      sendSmtpEmail.attachment = [
        {
          content: pdfBuffer.toString("base64"),
          name: pdfName || "attachment.pdf",
          type: "application/pdf",
        },
      ];
    }

    // 🟢 hantar email
    const response = await client.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
    return response;

  } catch (err) {
    console.error("❌ Ralat hantar emel:", err.response?.data || err.message);
    throw err;
  }
}

// 🔥 export default supaya senang import
export default sendEmail;
