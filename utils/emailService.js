import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "s13684.securessl.net",
  port: 465,
  secure: true,
  auth: {
    user: "rahman_uwl@edenzil.com",
    pass: "Uwl(9330)",
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
});

// 🔵 NOW SUPPORT ATTACHMENTS
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    await transporter.sendMail({
      from: `"e-Approval System" <rahman_uwl@edenzil.com>`,
      to,
      subject,
      html,
      attachments, // <-- SUPPORT ATTACHMENT DI SINI
    });

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`);
  } catch (error) {
    console.error("❌ Ralat hantar emel:", error);
  }
};


export default sendEmail;



