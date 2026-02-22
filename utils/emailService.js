import axios from "axios";

export const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "E-Approval System",
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: htmlContent,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Email send error:", error.response?.data || error.message);
  }
};
