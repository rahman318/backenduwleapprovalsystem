import axios from "axios";

export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "E-Approval System",
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        attachment: attachments.map(att => ({
          name: att.filename,
          content: att.content.toString("base64"),
        })),
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("BREVO KEY:", process.env.BREVO_API_KEY ? "Loaded ✅" : "Missing ❌");
    console.log("SENDER:", process.env.BREVO_SENDER_EMAIL);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email sending failed:", error.response?.data || error.message);
    throw error;
  }
};

