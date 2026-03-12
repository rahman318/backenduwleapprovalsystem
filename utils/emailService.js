// utils/sendEmail.js
import axios from "axios";

/**
 * Send email via Brevo (Sendinblue) with attachments support
 * @param {Object} options
 * @param {string} options.to - recipient email
 * @param {string} options.subject - email subject
 * @param {string} options.html - HTML content
 * @param {Array} options.attachments - [{ filename, content (Buffer or Base64) }]
 */
export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!to) throw new Error("❌ Recipient email is missing!");

  // Convert attachments to proper Brevo format
  const brevoAttachments = attachments.length
    ? attachments.map(att => ({
        name: att.filename,
        content: Buffer.isBuffer(att.content)
          ? att.content.toString("base64") // convert Buffer to Base64
          : att.content.toString().replace(/\s/g, ""), // ensure Base64 string is clean
      }))
    : undefined;

  const emailData = {
    sender: {
      name: "E-Approval System",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment: brevoAttachments,
  };

  try {
    const response = await axios.post("https://api.brevo.com/v3/smtp/email", emailData, {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log(`✅ Email sent to ${to}`);
    return response.data;
  } catch (err) {
    console.error("❌ Email sending failed:", err.response?.data || err.message);
    throw err;
  }
};
