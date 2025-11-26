// routes/requests.js
import express from "express";
import Request from "../models/Requests.js";
import User from "../models/User.js";
import sendEmail from "../utils/emailService.js"; // ✅ pastikan utils/emailService.js ada

const router = express.Router();

// CREATE Request
router.post("/", async (req, res) => {
  try {
    const { userId, requestType, leaveDate, details, approver } = req.body;

    // Cari user berdasarkan userId
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Auto inject staffName
    const newRequest = new Request({
      userId,
      staffName: user.username, // ✅ ambik dari username
      requestType,
      leaveDate,
      details,
      approver,
    });

    await newRequest.save();

    // 🔔 Hantar emel ke approver kalau ada
    if (approver) {
      const approverUser = await User.findById(approver);
      if (approverUser?.email) {
        const subject = `New Request from ${newRequest.staffName || "Staff"}`;
        const text = `
Hi ${approverUser.username || "Approver"},

Anda ada request baru untuk semakan.

Jenis Request: ${newRequest.requestType}
Nama Staff: ${newRequest.staffName || "-"}
Tarikh Cuti: ${newRequest.leaveDate || "-"}
Keterangan: ${newRequest.details || "-"}

Sila login ke e-Approval untuk tindakan.
`;
        sendEmail(approverUser.email, subject, text); // ✅ trigger email
      }
    }

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all Requests (untuk Admin/Approver)
router.get("/", async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("approver", "username email") // ✅ populate username & email
      .populate("userId", "username email");   // ✅ populate username & email
    res.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;