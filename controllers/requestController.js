// controllers/requestController.js
import Request from "../models/Requests.js";
import { generateRequestPDF } from "../utils/generatePDF.js";
import { sendEmailWithPDF } from "../utils/sendEmailWithPDF.js";
import fs from "fs";
import path from "path";

// Folder untuk simpan PDF (optional)
const PDF_DIR = path.join(process.cwd(), "generated_pdfs");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });


// 🟢 CREATE REQUEST
export const createRequest = async (req, res) => {
  try {
    const { userId, staffName, requestType, approver, approverName, approverDepartment,
      leaveStart, leaveEnd, details, signatureStaff } = req.body;

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

    // Generate PDF → Buffer + Save ke disk (optional)
    let pdfBuffer = null;
    const pdfName = `request_${newRequest._id}.pdf`;
    const pdfPath = path.join(PDF_DIR, pdfName);

    try {
      pdfBuffer = await generateRequestPDF(populatedRequest);
      fs.writeFileSync(pdfPath, pdfBuffer);
    } catch (err) {
      console.warn("⚠️ Gagal generate PDF:", err.message);
    }

    // Hantar email ke approver + PDF buffer
    if (populatedRequest?.approver?.email) {
      const subject = `Permohonan Baru Dari ${staffName}`;
      const html = `
        <h2>Notifikasi Permohonan Baru</h2>
        <p>Hi <b>${populatedRequest.approver?.username || "Approver"}</b>,</p>
        <p>Anda mempunyai permohonan baru untuk disemak.</p>
        <p><b>Nama Staff:</b> ${staffName}</p>
        <p><b>Jenis Permohonan:</b> ${requestType}</p>
        <p><b>Butiran:</b> ${details || "-"}</p>
        ${requestType === "Cuti" ? `<p><b>Tarikh Mula:</b> ${leaveStart}</p><p><b>Tarikh Tamat:</b> ${leaveEnd}</p>` : ""}
        <hr/>
        <p>Sila log masuk: <a href="https://uwleapprovalsystem.onrender.com">Dashboard</a></p>
      `;

      await sendEmailWithPDF({
        to: populatedRequest.approver.email,
        subject,
        html,
        pdfBuffer,
        pdfName
      });
    }

    res.status(201).json(populatedRequest);

  } catch (err) {
    console.error("❌ Error createRequest:", err.message);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
  }
};

// ✍️ APPROVE REQUEST + EMAIL STAFF
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

    // Generate PDF (buffer + simpan disk)
    let pdfBuffer = null;
    const pdfName = `approved_${request._id}.pdf`;
    const pdfPath = path.join(PDF_DIR, pdfName);

    try {
      pdfBuffer = await generateRequestPDF(request);
      fs.writeFileSync(pdfPath, pdfBuffer);
    } catch (err) {
      console.warn("⚠️ Gagal generate PDF:", err.message);
    }

    // Hantar email ke staff
    const staffEmail = request.userId?.email;
    const staffName = request.userId?.username || request.staffName;
    const approverName = request.approver?.username || "Approver";

    if (staffEmail) {
      const html = `
        <h2>Notifikasi e-Approval</h2>
        <p>Hi <b>${staffName}</b>,</p>
        <p>Permohonan anda telah <b style="color:green;">DILULUSKAN</b> oleh ${approverName}.</p>
      `;

      await sendEmailWithPDF({
        to: staffEmail,
        subject: `Permohonan Diluluskan`,
        html,
        pdfBuffer,
        pdfName
      });
    }

    res.status(200).json({ message: "Request approved", request });

  } catch (err) {
    console.error("❌ approveRequest error:", err.message);
    res.status(500).json({ message: "Gagal approve request" });
  }
};


// 🟣 DOWNLOAD PDF — (Restore balik!)
export const getPDFforRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const pdfPath = path.join(PDF_DIR, `request_${requestId}.pdf`);
    const pdfPathApproved = path.join(PDF_DIR, `approved_${requestId}.pdf`);

    // Check dua jenis
    let filePath = null;

    if (fs.existsSync(pdfPathApproved)) filePath = pdfPathApproved;
    else if (fs.existsSync(pdfPath)) filePath = pdfPath;
    else return res.status(404).json({ message: "PDF tidak dijumpai" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);

    fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    console.error("❌ Error getPDFforRequest:", err.message);
    res.status(500).json({ message: "Gagal ambil PDF" });
  }
};



// 🔵 GET REQUEST LIST
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
