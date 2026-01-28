// controllers/requestController.js
import Request from "../models/Requests.js";
import sendEmail from "../utils/emailService.js";
import { generateGenericPDF } from "../utils/generateGenericPDF.js";
import generatePDF from "../utils/generatePDF.js";
import fs from "fs";

// ================== DELETE REQUEST ==================
export const deleteRequestById = async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================== CREATE REQUEST ==================
export const createRequest = async (req, res) => {
  try {
    const {
      userId,
      staffName,
      staffDepartment,
      requestType,
      details,
      signatureStaff,
      leaveStart,
      leaveEnd,
      items,
      approvals,
    } = req.body;

 // ================== GENERATE SERIAL NUMBER ==================
    const lastRequest = await Request.findOne().sort({ createdAt: -1 });

    let lastNumber = 0;
    if (lastRequest && lastRequest.serialNumber) {
      const parts = lastRequest.serialNumber.split("-");
      lastNumber = parseInt(parts[2]) || 0;
    }

    const year = new Date().getFullYear();
    const serialNumber = `REQ-${year}-${String(lastNumber + 1).padStart(4, "0")}`;
    // ============================================================

    // ================== FIX ATTACHMENTS ==================
const attachments = [];

if (req.file) {
  attachments.push({
    originalName: req.file.originalname,
    fileName: req.file.filename,
    filePath: req.file.path,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
}

    // ================= FIX APPROVALS =================
    let approvalsData = [];
    if (approvals) {
      let parsedApprovals = approvals;
      if (typeof approvals === "string") {
        try {
          parsedApprovals = JSON.parse(approvals);
        } catch {
          parsedApprovals = [];
        }
      }
      if (Array.isArray(parsedApprovals)) {
        approvalsData = parsedApprovals.map((a, index) => ({
          level: a.level || index + 1,
          approverId: a.approverId || null,
          approverName: a.approverName || "-",
          approverDepartment: a.approverDepartment || "-",
          status: "Pending",
          remark: "",
          signature: null,
          actionDate: null,
        }));
      }
    }

    // ===================== FIX MULTI-ITEM =====================
    let itemsData = [];
    if (items) {
      if (typeof items === "string") {
        try {
          itemsData = JSON.parse(items);
          if (!Array.isArray(itemsData)) itemsData = [];
        } catch {
          itemsData = [];
        }
      } else if (Array.isArray(items)) {
        itemsData = items;
      }

      itemsData = itemsData.map((item) => ({
        itemName: item.itemName || item.description || "-",
        quantity: Number(item.quantity) || Number(item.qty) || 0,
        estimatedCost: Number(item.estimatedCost) || 0,
        supplier: item.supplier || "",
        reason: item.reason || item.remarks || "-",
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
      }));
    }

    const newRequest = new Request({
      userId,
      staffName,
      staffDepartment: staffDepartment || "-",
      requestType,
      details: details || "",
      signatureStaff: signatureStaff || "",
      attachments: attachments, // ✅ fixed
      leaveStart: requestType === "Cuti" ? leaveStart : undefined,
      leaveEnd: requestType === "Cuti" ? leaveEnd : undefined,
      items: itemsData,
      approvals: approvalsData,
      serialNumber,
      finalStatus: "Pending",
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email");

    // generate PDF optional
    try {
      if (!fs.existsSync("generated_pdfs")) fs.mkdirSync("generated_pdfs");
      const pdfBuffer = await generateRequestPDF(populatedRequest);
      const safeType = requestType.toLowerCase().replace(/\s+/g, "_");
      const pdfPath = `generated_pdfs/${newRequest._id}_${safeType}.pdf`;
      fs.writeFileSync(pdfPath, pdfBuffer);
    } catch (pdfErr) {
      console.error("❌ Error generate PDF:", pdfErr.message);
    }

    // send email to approvers
    for (const approval of populatedRequest.approvals) {
      if (!approval.approverId?.email) continue;
      const subject = `Permohonan Baru Dari ${staffName}`;
      const html = `
        <p>Hi ${approval.approverId.username || approval.approverName || "Approver"},</p>
        <p>Anda mempunyai permohonan baru untuk semakan.</p>
        <p><b>Jenis Permohonan:</b> ${requestType}</p>
        <p><b>Butiran:</b> ${details || "-"}</p>
        ${
          requestType === "Cuti"
            ? `<p><b>Tarikh Mula:</b> ${leaveStart}</p><p><b>Tarikh Tamat:</b> ${leaveEnd}</p>`
            : ""
        }
        ${
          itemsData.length
            ? `<hr/><p><b>Senarai Item:</b></p><ul>${itemsData
                .map(
                  (i, idx) =>
                    `<li>${idx + 1}. ${i.itemName} | Qty: ${i.quantity} | ${i.reason || "-"}</li>`
                )
                .join("")}</ul>`
            : ""
        }
        <hr/>
        <p>Sila log masuk dashboard untuk semakan.</p>
      `;
      try {
        await sendEmail({ to: approval.approverId.email, subject, html });
      } catch (emailErr) {
        console.error("❌ Gagal hantar email:", emailErr.message);
      }
    }

    res.status(201).json(populatedRequest);
  } catch (err) {
    console.error("❌ createRequest error:", err.message);
    res.status(500).json({ message: "Gagal simpan request", error: err.message });
  }
};

// ================== GET ALL REQUEST ==================
export const getRequests = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("userId", "username department email")
      .populate("approvals.approverId", "username department email")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    console.error("❌ getRequests error:", err.message);
    res.status(500).json({ message: "Gagal ambil senarai request", error: err.message });
  }
};

// ================== APPROVE LEVEL ==================
export const approveLevel = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate("userId");
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelToApprove = request.approvals.find(
      (a) => a.approverId?.toString() === req.user._id.toString()
    );
    if (!levelToApprove) return res.status(403).json({ message: "Not authorized to approve" });

    levelToApprove.status = "Approved";
    levelToApprove.actionDate = new Date();
    if (req.body.signatureApprover) levelToApprove.signature = req.body.signatureApprover;

    // ✅ Check all levels
    const allApproved = request.approvals.every((a) => a.status === "Approved");
    if (allApproved) request.finalStatus = "Approved";

    // ================== FINAL APPROVAL ==================
    if (allApproved) {
      // 🔥 Generate PDF
      const pdfBuffer = await generateGenericPDF(request);

      // 🔥 Send email to staff
      const staffEmail = request.userId?.email; // <-- ikut populate
      if (staffEmail) {
        await sendEmail({
          to: staffEmail,
          subject: "Permohonan Anda Telah Diluluskan",
          html: `
            <p>Assalamualaikum ${request.staffName},</p>
            <p>Permohonan anda telah <b>DILULUSKAN</b>.</p>
            <p>Sila rujuk PDF yang dilampirkan.</p>
            <br/>
            <p>Terima kasih.</p>
          `,
          attachments: [
            {
              filename: `Permohonan_${request._id}.pdf`,
              content: pdfBuffer,
            },
          ],
        });
      }
    }

    await request.save();

    res.status(200).json({
      message: "Level approved",
      request,
    });
  } catch (err) {
    console.error("❌ approveLevel error:", err.message);
    res.status(500).json({
      message: "Gagal approve level",
      error: err.message,
    });
  }
};


// ================== REJECT LEVEL ==================
export const rejectLevel = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const levelToReject = request.approvals.find(
      (a) => a.approverId?.toString() === req.user._id.toString()
    );
    if (!levelToReject) return res.status(403).json({ message: "Not authorized to reject" });

    levelToReject.status = "Rejected";
    levelToReject.actionDate = new Date();
    if (req.body.signatureApprover) levelToReject.signature = req.body.signatureApprover;

    request.finalStatus = "Rejected";

    await request.save();
    res.status(200).json({ message: "Level rejected", request });
  } catch (err) {
    console.error("❌ rejectLevel error:", err.message);
    res.status(500).json({ message: "Gagal reject level", error: err.message });
  }
};

// ================== GET PDF ==================
export const downloadGenericPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await Request.findById(id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });

    const pdfBytes = await generateGenericPDF(request);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Request_${id}.pdf`,
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ Generic PDF error:", err);
    res.status(500).json({ message: "Gagal jana PDF" });
  }
};

export const downloadPurchasePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await Request.findById(id).populate("approvals userId");
    if (!request) return res.status(404).json({ message: "Request tak jumpa" });

    const pdfBytes = await generatePDF(request);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Purchase_${id}.pdf`,
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ Purchase PDF error:", err);
    res.status(500).json({ message: "Gagal jana PDF" });
  }
};
