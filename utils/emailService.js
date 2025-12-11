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
      attachment: [], // akan push attachment betul
    };

    for (const att of attachments) {
      let base64Content = "";

      if (att.path) {
        const fileBuffer = fs.readFileSync(att.path);
        base64Content = fileBuffer.toString("base64");
      } else if (att.content && Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString("base64");
      } else if (typeof att.content === "string") {
        base64Content = att.content;
      }

      if (base64Content) {
        payload.attachment.push({
          name: att.filename,
          content: base64Content,
          type: att.type || "application/octet-stream", // pastikan MIME type
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

export default sendEmail;
