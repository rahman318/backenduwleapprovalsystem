import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "underwaterworldlangkawi.com",
  port: 465,
  secure: true,
  auth: {
    user: "admin@underwaterworldlangkawi.com",
    pass: "Uwl<9330>",
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 50000,
  greetingTimeout: 50000,
});

// 🔵 NOW SUPPORT ATTACHMENTS
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    await transporter.sendMail({
      from: `"e-Approval System" <admin@underwaterworldlangkawi.com>`,
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
