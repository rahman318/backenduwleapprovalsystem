import Request from "../models/Request.js";
import User from "../models/user.js";
import sendEmail from "../utils/sendEmail.js"; // helper untuk Nodemailer

export const createRequest = async (req, res) => {
  try {
    
    // 🔍 DEBUG FILE – LETAK SINI
    console.log("FILE:", req.file);
    console.log("BODY:", req.body);

const { userId, staffName, requestType, details, approvals, signatureStaff } = req.body;

    if (!userId || !staffName || !requestType) {
      return res.status(400).json({ message: "Field wajib tidak lengkap" });
    }

    const staff = await User.findById(userId);
    const staffDepartment = staff?.department || "-";

    // 🔥 Handle approvals, hanya yang ada approverId
    let approvalsData = [];

    if (approvals) {
      let parsedApprovals = approvals;

      if (typeof approvals === "string") {
        try {
          parsedApprovals = JSON.parse(approvals);
        } catch (e) {
          console.warn("❌ Failed parse approvals");
          parsedApprovals = [];
        }
      }

      if (Array.isArray(parsedApprovals)) {
        approvalsData = parsedApprovals
          .filter(a => a.approverId) // ❌ buang yang null/undefined
          .map((a, index) => ({
            level: a.level || index + 1,
            approverId: a.approverId,
            approverName: a.approverName || "-",
            approverDepartment: a.approverDepartment || "-",
            status: "Pending",
            remark: "",
            signature: null,
            actionDate: null,
          }));
      }
    }

// 🔥 FILE DATA – INI TEMPAT YANG BETUL
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

    const newRequest = new Request({
      userId,
      staffName,
      requestType,
      details: details ? JSON.parse(details) : {},
      items: items ? JSON.parse(items) : [],
      approvals: approvals ? JSON.parse(approvals) : [],
      signatureStaff: signatureStaff || null,
      attachments, // ✅ SIMPAN SINI
      finalStatus: "Pending",
    });

    await newRequest.save();

    // 🔥 Hantar email ke staff / requestor
    const emailSubject = `Request Anda (${requestType}) Telah Dihantar`;
    const emailBody = `
      Salam ${staffName},
      <br><br>
      Request anda telah berjaya dihantar dan sedang menunggu approval.
      <br>
      Jenis Request: ${requestType}
      <br>
      Sila semak portal untuk status terkini.
      <br><br>
      Terima kasih.
    `;

    if (staff.email) {
      await sendEmail(staff.email, emailSubject, emailBody);
    }

    res.status(201).json({ message: "Request berjaya dihantar dan email notifikasi dihantar", request: newRequest });
  } catch (err) {
    console.error("❌ createRequest Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
