// utils/emailService.js
import axios from "axios";

export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!to) throw new Error("❌ Recipient email is missing!");

  // Process attachments
  const processedAttachments = attachments.length
    ? attachments.map(att => {
        if (!att.content || (Buffer.isBuffer(att.content) && att.content.length === 0)) {
          console.warn(`⚠️ Attachment "${att.filename}" kosong, skip attach`);
          return null;
        }

        return {
          name: att.filename || "attachment.pdf",
          content: Buffer.isBuffer(att.content)
            ? att.content.toString("base64")
            : att.content,
          type: att.type || "application/pdf",
          disposition: "attachment",
        };
      }).filter(Boolean)
    : undefined;

  const emailData = {
    sender: {
      name: "E-Approval System",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment: processedAttachments,
  };

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      emailData,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Email sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Email sending failed:",
      error.response?.data || error.message
    );
    throw error;
  }
};
