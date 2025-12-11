// utils/emailService.js
import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const payload = {
      sender: { name: "e-Approval System", email: "admin@underwaterworldlangkawi.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: [],
    };

    for (const att of attachments) {
      let base64Content = null;

      if (att.content) {
        if (Buffer.isBuffer(att.content)) {
          base64Content = att.content.toString("base64");
        } else {
          base64Content = att.content;
        }
      } else if (att.path) {
        const fileBuffer = fs.readFileSync(att.path);
        base64Content = fileBuffer.toString("base64");
      }

      if (base64Content) {
        payload.attachment.push({
          name: att.filename,
          content: base64Content,
        });
      }
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
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
};

// default export
export default sendEmail;
