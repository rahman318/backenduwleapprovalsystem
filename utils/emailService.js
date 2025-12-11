import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendEmail via Brevo API (REST)
 * @param {string} to - penerima email
 * @param {string} subject - subject email
 * @param {string} html - content HTML
 * @param {Buffer} [pdfBuffer] - optional PDF attachment
 * @param {string} [pdfName] - nama PDF
 */
async function sendEmail({ to, subject, html, pdfBuffer, pdfName }) {
  try {
    const data = {
      sender: { name: "e-Approval System", email: "noreply@yourcompany.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: pdfBuffer
        ? [
            {
              name: pdfName || "attachment.pdf",
              content: pdfBuffer.toString("base64"),
              type: "application/pdf",
            },
          ]
        : undefined,
    };

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      data,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
    return response.data;
  } catch (err) {
    console.error("❌ Ralat hantar emel:", err.response?.data || err.message);
    throw err;
  }
}

export default sendEmail;
