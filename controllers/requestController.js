import Request from "../models/Requests.js";
import sendEmail from "../utils/emailService.js";
import { generateRequestPDF } from "../utils/generatePDF.js";
import fs from "fs";

// 🟢 CREATE REQUEST
export const createRequest = async (req, res) => {
  try {
    const { 
      userId, 
      staffName, 
      requestType, 
      approver, 
      approverName,
      approverDepartment,
      leaveStart, 
      leaveEnd, 
      details,
      signatureStaff 
    } = req.body;

    let fileUrl = null;
    if (req.file) {
      fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    const newRequest = new Request({
      userId,
      staffName,
      staffDepartment: req.body.staffDepartment,
      requestType,
      approver,
      approverName,
      approverDepartment,
      details,
      signatureStaff,
      file: fileUrl,
      leaveStart: requestType === "Cuti" ? leaveStart : undefined,
      leaveEnd: requestType === "Cuti" ? leaveEnd : undefined,
      items: requestType === "Pembelian" ? JSON.parse(req.body.items || "[]") : undefined
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate("approver", "username department email");

    // 🟣 JANA PDF
    try {
      if (!fs.existsSync("generated_pdfs")) fs.mkdirSync("generated_pdfs");

      const pdfBytes = await generateRequestPDF(populatedRequest);
      const safeType = requestType.toLowerCase().replace(/\s+/g, "_");
      const pdfPath = `generated_pdfs/${newRequest._id}_${safeType}.pdf`;

      fs.writeFileSync(pdfPath, pdfBytes);
      console.log("📄 PDF dijana:", pdfPath);
    } catch (pdfErr) {
      console.error("❌ Error jana PDF:", pdfErr.message);
    }

    // 🟢 HANTAR EMAIL KEPADA APPROVER
    try {
      if (populatedRequest?.approver?.email) {
        const subject = `Permohonan Baru Dari ${staffName}`;
        const html = `
          <h2>Notifikasi Permohonan Baru</h2>
          <p>Hi <b>${
            populatedRequest.approver?.username || approverName || "Approver"
          }</b>,</p>
          <p>Anda mempunyai permohonan baru untuk disemak.</p>

          <p><b>Nama Staff:</b> ${staffName}</p>
          <p><b>Jenis Permohonan:</b> ${requestType}</p>
          <p><b>Butiran:</b> ${details || "-"}</p>

          ${
            requestType === "Cuti"
              ? `<p><b>Tarikh Mula:</b> ${leaveStart}</p>
                 <p><b>Tarikh Tamat:</b> ${leaveEnd}</p>`
              : ""
          }

          <hr/>
          <p>Sila log masuk untuk semak:</p>
          <p><a href="https://uwleapprovalsystem.onrender.com">Buka Dashboard</a></p>
          <br/>
          <p>Terima kasih,<br/>Sistem e-Approval</p>
        `;

        await sendEmail({
          to: populatedRequest.approver.email,
          subject,
          html,
          attachments: [],
        });
        console.log("📨 Emel notifikasi dihantar kepada approver!");
      } else {
        console.warn("⚠️ Approver tiada email. Notifikasi tidak dihantar.");
      }
    } catch (emailErr) {
      console.error("❌ Gagal menghantar emel approver:", emailErr.message);
    }

    res.status(201).json(populatedRequest);

  } catch (err) {
    console.error("❌ Error createRequest:", err.message);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
  }
};

// 🟡 GET SEMUA REQUEST
export const getRequests = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("userId", "username email role")
      .populate("approver", "username email role")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    console.error("❌ Error getRequests:", err.message);
    res.status(500).json({ message: "Gagal ambil senarai request" });
  }
};

// 📄 GET PDF EXISTING
export const getPDFforRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);

    if (!request) return res.status(404).json({ message: "Request not found" });

    const safeType = request.requestType.toLowerCase().replace(/\s+/g, "_");
    const pdfPath = `generated_pdfs/${id}_${safeType}.pdf`;

    if (!fs.existsSync(pdfPath)) return res.status(404).json({ message: "PDF not found" });

    res.sendFile(`${process.cwd()}/${pdfPath}`);
  } catch (err) {
    console.error("❌ getPDFforRequest error:", err.message);
    res.status(500).json({ message: "Failed to fetch PDF", error: err.message });
  }
};

// 📄 GENERATE PDF ON THE FLY
export const getRequestPDF = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const pdfBytes = await generateRequestPDF(request);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=request-${request._id}.pdf`
    );

    res.send(pdfBytes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal generate PDF", error: err.message });
  }
};

// ✍️ APPROVE REQUEST + SEND EMAIL + PDF
export const approveRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("userId", "username email")
      .populate("approver", "username email");

    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = "Approved";
    request.signatureApprover = req.body.signatureApprover || null;
    request.updatedAt = Date.now();

    await request.save();

    // 🔄 REGENERATE PDF
    let pdfPath = null;
    try {
      if (!fs.existsSync("generated_pdfs")) fs.mkdirSync("generated_pdfs");

      const pdfBytes = await generateRequestPDF(request);
      const safeType = request.requestType.toLowerCase().replace(/\s+/g, "_");
      pdfPath = `generated_pdfs/${request._id}_${safeType}.pdf`;

      fs.writeFileSync(pdfPath, pdfBytes);
    } catch (err) {
      console.error("❌ PDF generation failed:", err.message);
    }

    // 📨 SEND EMAIL TO STAFF
    const staffEmail = request.userId?.email;
    const staffName = request.userId?.username || request.staffName;
    const approverName =
      request.approver?.username || request.approverName || "Approver";

    if (staffEmail) {
      const attachments = pdfPath
        ? [
            {
              filename: `approved_${request._id}.pdf`,
              path: `${process.cwd()}/${pdfPath}`,
            },
          ]
        : [];

      const html = `
        <h2>Notifikasi e-Approval</h2>
        <p>Hi <b>${staffName}</b>,</p>
        <p>Permohonan anda telah <b style="color:green;">DILULUSKAN</b> oleh ${approverName}.</p>
        <p><b>Jenis Permohonan:</b> ${request.requestType}</p>
        <p><b>Butiran:</b> ${request.details || "-"}</p>
        <hr/>
        <p>Terima kasih,<br/>Sistem e-Approval</p>
      `;

      await sendEmail({
        to: staffEmail,
        subject: "✅ Permohonan Diluluskan",
        html,
        attachments,
      });

      console.log("📨 Approved email sent to staff (PDF attached)");
    }

    res.status(200).json({ message: "Request approved & email sent", request });
  } catch (err) {
    console.error("❌ approveRequest error:", err.message);
    res.status(500).json({ message: "Gagal approve request", error: err.message });
  }
};

// 🔵 UPDATE STATUS + REGENERATE PDF + EMAIL (APPROVE/REJECT)
export const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Status tak sah" });
    }

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    )
      .populate("userId", "username email")
      .populate("approver", "username email department");

    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    console.log("✅ Status dikemaskini:", request.status);

    // 🔄 REGENERATE PDF
    try {
      if (!fs.existsSync("generated_pdfs")) fs.mkdirSync("generated_pdfs");

      const pdfBytes = await generateRequestPDF(request);
      const safeType = request.requestType.toLowerCase().replace(/\s+/g, "_");
      const pdfPath = `generated_pdfs/${request._id}_${safeType}.pdf`;

      fs.writeFileSync(pdfPath, pdfBytes);
      console.log("🔄 PDF dikemaskini:", pdfPath);
    } catch (err) {
      console.error("❌ Error regenerate PDF:", err.message);
    }

    // 📨 SEND EMAIL TO STAFF
    const normalizedStatus = status.toLowerCase();
    if (["approved", "rejected"].includes(normalizedStatus)) {
      const staffEmail = request.userId?.email;
      const staffName = request.userId?.username || request.staffName;
      const approverName =
        request.approver?.username || request.approverName || "Approver";

      let attachments = [];
      if (normalizedStatus === "approved") {
        const safeType = request.requestType.toLowerCase().replace(/\s+/g, "_");
        const pdfPath = `generated_pdfs/${request._id}_${safeType}.pdf`;

        if (fs.existsSync(pdfPath)) {
          attachments.push({
            filename: `approved_${safeType}.pdf`,
            path: `${process.cwd()}/${pdfPath}`,
          });
        }
      }

      if (staffEmail) {
        const html = `
          <h2>Notifikasi e-Approval</h2>
          <p>Hi <b>${staffName}</b>,</p>
          <p>Permohonan anda telah <b>${status}</b> oleh ${approverName}.</p>
          <p><b>Jenis Permohonan:</b> ${request.requestType}</p>
          <p><b>Butiran:</b> ${request.details || "-"}</p>
          <hr/>
          <p>Terima kasih,<br/>Sistem e-Approval</p>
        `;

        await sendEmail({
          to: staffEmail,
          subject: `Permohonan Anda Telah ${status}`,
          html,
          attachments,
        });

        console.log("📨 Email status sent to staff (PDF attached if Approved)");
      }
    }

    res.status(200).json(request);

  } catch (err) {
    console.error("❌ Error updateRequestStatus:", err.message);
    res.status(500).json({ message: "Gagal update status request" });
  }
};
