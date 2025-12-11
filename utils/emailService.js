// emailService.js
import Brevo from "@getbrevo/brevo";
import { generateRequestPDF } from "../utils/generatePDF.js"; // pastikan path betul
import dotenv from "dotenv";
dotenv.config();

/**
 * sendRequestEmail
 * Hantar email + PDF terus (Base64) tanpa simpan file
 * @param {Object} request - object request e-Approval
 */
const sendRequestEmail = async (request) => {
  try {
    // ---------------- 1️⃣ Generate PDF buffer ----------------
    const pdfBytes = await generateRequestPDF(request);

    // ---------------- 2️⃣ Convert PDF to Base64 ----------------
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ---------------- 3️⃣ Setup Brevo Client ----------------
    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    // ---------------- 4️⃣ Prepare Email ----------------
    const sendSmtpEmail = {
      to: [{ email: request.userId.email, name: request.userId.name }],
      sender: { email: "noreply@yourcompany.com", name: "e-Approval System" },
      subject: `Permohonan Anda: ${request.requestType}`,
      textContent: "Sila rujuk PDF dilampirkan.",
      attachment: [
        {
          content: pdfBase64,
          name: `request_${request._id}.pdf`,
          type: "application/pdf",
        },
      ],
    };

    // ---------------- 5️⃣ Send Email ----------------
    const response = await client.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email berjaya dihantar kepada: ${request.userId.email}`, response);
    return response;

  } catch (error) {
    console.error("❌ Ralat hantar email:", error);
    throw error;
  }
};

// 🟢 Export default supaya import boss di controller jadi smooth
export default sendRequestEmail;

