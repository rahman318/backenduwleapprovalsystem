// utils/emailService.js
import Brevo from "@getbrevo/brevo";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendEmail via Brevo SDK (v3)
 */
async function sendEmail({ to, subject, html, pdfBuffer, pdfName }) {
  try {
    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = {
      to: [{ email: to }],
      sender: { email: "noreply@yourcompany.com", name: "e-Approval System" },
      subject,
      htmlContent: html,
    };

    // ✅ attach PDF kalau ada
    if (pdfBuffer) {
      sendSmtpEmail.attachment = [
        {
          name: pdfName || "attachment.pdf",
          contentBase64: pdfBuffer.toString("base64"), // <- wajib guna contentBase64
          type: "application/pdf",
        },
      ];
    }

    const response = await client.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
    return response;

  } catch (err) {
    console.error("❌ Ralat hantar emel:", err.response?.data || err.message);
    throw err;
  }
}

export default sendEmail;
