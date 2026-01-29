import Request from "../models/Request.js";
import User from "../models/user.js";
import sendEmail from "../utils/sendEmail.js"; // helper untuk Nodemailer

export const createRequest = async (req, res) => {
  try {
    // 🔍 DEBUG FILE – tengok req.file & req.fileUrl
    console.log("REQ FILE:", req.file);       // multer info
    console.log("REQ FILE URL:", req.fileUrl); // public URL dari Supabase
    console.log("BODY:", req.body);

    const {
      userId,
      staffName,
      requestType,
      details,
      items,
      approvals,
      signatureStaff,
    } = req.body;

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
          .filter(a => a.approverId)
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

    // 🔥 FILE DATA – GUNA req.fileUrl dari Supabase
    let attachments = [];
if (req.file) {
  attachments.push({
    originalName: req.file.originalname,
    fileName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
    url: req.fileUrl || null, // <-- dari Supabase
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
}

    // =========================
    // ✅ Simpan request ke MongoDB
    // =========================
    const newRequest = new Request({
  userId,
  staffName,
  staffDepartment: staffDepartment || "-",
  requestType,
  details: parsedDetails,
  items: parsedItems,
  approvals: approvalsData,
  signatureStaff: signatureStaff || null,
  file: req.fileUrl || null,
  attachments: req.fileUrl
    ? [{
        originalName: req.file?.originalname,
        fileUrl: req.fileUrl,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
      }]
    : [],
  finalStatus: "Pending",
});

    await newRequest.save();

    // =========================
    // 🔥 Hantar email ke staff
    // =========================
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

    res.status(201).json({
      message:
        "Request berjaya dihantar dan email notifikasi dihantar",
      request: newRequest,
    });
  } catch (err) {
    console.error("❌ createRequest Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




