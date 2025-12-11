import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendEmail
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @param {Buffer|null} pdfBuffer
 * @param {string|null} pdfName
 */
const sendEmail = async ({ to, subject, html, pdfBuffer, pdfName }) => {
  try {
    const payload = {
      sender: { 
        name: "e-Approval System", 
        email: "admin@underwaterworldlangkawi.com" 
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: []
    };

    // kalau ada PDF buffer
    if (pdfBuffer && pdfName) {
      payload.attachment.push({
        name: pdfName,
        content: pdfBuffer.toString("Base64")
      });
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Email sent:", to);
    return response.data;

  } catch (err) {
    console.error("❌ Ralat Brevo:", err.response?.data || err.message);
    throw err;
  }
};

export default sendEmail;


