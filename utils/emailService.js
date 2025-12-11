// utils/emailService.js
import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendEmail
 * Hantar email via Brevo API
 * @param {Object} options
 * @param {string} options.to - penerima
 * @param {string} options.subject - subject email
 * @param {string} options.html - content email (HTML)
 * @param {Array} [options.attachments] - optional array attachment { filename, path?, content? (Buffer/base64) }
 */
export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const payload = {
      sender: { name: "e-Approval System", email: "admin@underwaterworldlangkawi.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: [],
    };

    // Process attachments (support buffer, path, or base64 string)
    for (const att of attachments) {
      let base64Content = null;

      if (att.content) {
        // buffer atau base64 string
        if (Buffer.isBuffer(att.content)) {
          base64Content = att.content.toString("base64");
        } else {
          base64Content = att.content; // assume already base64
        }
      } else if (att.path) {
        // read file from path
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
