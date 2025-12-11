// controllers/requestController.js
import Request from "../models/Requests.js";
import { generateRequestPDF } from "../utils/generatePDF.js";
import { sendEmailWithPDF } from "../utils/sendEmailWithPDF.js";
import fs from "fs";

// 🟢 CREATE REQUEST
export const createRequest = async (req, res) => {
  try {
    const { 
      userId, staffName, requestType, approver, approverName,
      approverDepartment, leaveStart, leaveEnd, details, signatureStaff 
    } = req.body;

    const fileUrl = req.file ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` : null;

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

    let pdfBuffer = null;
    try { pdfBuffer = await generateRequestPDF(populatedRequest); } 
    catch (err) { console.warn("⚠️ Gagal generate PDF:", err.message); }

    if (populatedRequest?.approver?.email) {
      const subject = `Permohonan Baru Dari ${staffName}`;
      const html = `
        <h2>Notifikasi Permohonan Baru</h2>
        <p>Hi <b>${populatedRequest.approver?.username || approverName || "Approver"}</b>,</p>
        <p>Anda mempunyai permohonan baru untuk disemak.</p>
        <p><b>Nama Staff:</b> ${staffName}</p>
        <p><b>Jenis Permohonan:</b> ${requestType}</p>
        <p><b>Butiran:</b> ${details || "-"}</p>
        ${requestType === "Cuti" ? `<p><b>Tarikh Mula:</b> ${leaveStart}</p><p><b>Tarikh Tamat:</b> ${leaveEnd}</p>` : ""}
        <hr/>
        <p>Sila log masuk untuk semak: <a href="https://uwleapprovalsystem.onrender.com">Dashboard</a></p>
      `;

      await sendEmailWithPDF({
        to: populatedRequest.approver.email,
        subject,
        html,
        pdfBuffer,
        pdfName: `request_${newRequest._id}.pdf`
      });
    }

    res.status(201).json(populatedRequest);
  } catch (err) {
    console.error("❌ Error createRequest:", err.message);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
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
    res.setHeader("Content-Disposition", `inline; filename=request-${request._id}.pdf`);
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

    let pdfBuffer = null;
    try { pdfBuffer = await generateRequestPDF(request); } 
    catch (err) { console.warn("⚠️ Gagal generate PDF:", err.message); }

    const staffEmail = request.userId?.email;
    const staffName = request.userId?.username || request.staffName;
    const approverName = request.approver?.username || request.approverName || "Approver";

    if (staffEmail) {
      const html = `
        <h2>Notifikasi e-Approval</h2>
        <p>Hi <b>${staffName}</b>,</p>
        <p>Permohonan anda telah <b style="color:green;">DILULUSKAN</b> oleh ${approverName}.</p>
        <p><b>Jenis Permohonan:</b> ${request.requestType}</p>
        <p><b>Butiran:</b> ${request.details || "-"}</p>
      `;

      await sendEmailWithPDF({
        to: staffEmail,
        subject: `✅ Permohonan Diluluskan`,
        html,
        pdfBuffer,
        pdfName: `approved_${request._id}.pdf`
      });
    }

    res.status(200).json({ message: "Request approved & email sent", request });
  } catch (err) {
    console.error("❌ approveRequest error:", err.message);
    res.status(500).json({ message: "Gagal approve request", error: err.message });
  }
};

// 🔵 UPDATE STATUS + EMAIL
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
      .populate("approver", "username email");

    if (!request) return res.status(404).json({ message: "Request tidak dijumpai" });

    let pdfBuffer = null;
    try { pdfBuffer = await generateRequestPDF(request); } 
    catch (err) { console.warn("⚠️ Gagal generate PDF:", err.message); }

    const normalizedStatus = status.toLowerCase();
    const staffEmail = request.userId?.email;
    const staffName = request.userId?.username || request.staffName;
    const approverName = request.approver?.username || request.approverName || "Approver";

    if (staffEmail && ["approved","rejected"].includes(normalizedStatus)) {
      const html = `
        <h2>Notifikasi e-Approval</h2>
        <p>Hi <b>${staffName}</b>,</p>
        <p>Permohonan anda telah <b>${status}</b> oleh ${approverName}.</p>
        <p><b>Jenis Permohonan:</b> ${request.requestType}</p>
        <p><b>Butiran:</b> ${request.details || "-"}</p>
      `;

      await sendEmailWithPDF({
        to: staffEmail,
        subject: `Permohonan Anda Telah ${status}`,
        html,
        pdfBuffer: normalizedStatus === "approved" ? pdfBuffer : null,
        pdfName: normalizedStatus === "approved" && pdfBuffer ? `approved_${request._id}.pdf` : undefined
      });
    }

    res.status(200).json(request);
  } catch (err) {
    console.error("❌ Error updateRequestStatus:", err.message);
    res.status(500).json({ message: "Gagal update status request" });
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
