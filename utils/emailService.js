// utils/emailService.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// helper to mask key for logs
const shortKey = (k) => (k ? `${k.slice(0,8)}...${k.slice(-4)}` : 'MISSING');

const BREVO_KEY = process.env.BREVO_API_KEY;

// quick runtime check (will show in Render logs)
console.log("🔐 BREVO_API_KEY present?", !!BREVO_KEY, "value:", shortKey(BREVO_KEY));

/**
 * sendEmail({ to, subject, html, attachments })
 * attachments: [{ content: Buffer, filename: 'file.pdf', mimetype: 'application/pdf' }]
 */
const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    if (!BREVO_KEY) throw new Error("Missing BREVO_API_KEY in environment");

    // build attachments for Brevo: array of { name, content } where content is base64 string
    const brevoAttachments = attachments?.map(f => ({
      name: f.filename,
      content: f.content.toString('base64'),
      // Brevo ignores contentType field here for /v3/smtp/email but we keep filename+content
    }));

    const payload = {
      sender: { name: "e-Approval System", email: "admin@underwaterworldlangkawi.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(brevoAttachments && brevoAttachments.length ? { attachment: brevoAttachments } : {}),
    };

    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": BREVO_KEY,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log(`✅ Emel berjaya dihantar kepada: ${to}`, "brevoStatus:", res.status);
    return res.data;
  } catch (err) {
    // try to show Brevo response body if available for debugging
    const body = err?.response?.data ?? err?.message ?? err;
    console.error("❌ Ralat hantar emel:", body);
    throw err;
  }
};

export default sendEmail;
