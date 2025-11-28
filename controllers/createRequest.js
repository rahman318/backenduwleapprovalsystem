import Request from "../models/Request.js";
import User from "../models/user.js"; // pastikan import User untuk dapat staff info

// @desc Create new staff request
// @route POST /api/requests
// @access Private
export const createRequest = async (req, res) => {
  try {
    console.log("📦 req.body:", req.body);   
    console.log("📂 req.file:", req.file);   

    const { userId, staffName, requestType, details, approver, approverName, approverDepartment } = req.body;

    // validation
    if (!userId || !staffName || !requestType || !approver) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // ✅ ambil maklumat staff dari DB
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newRequest = new Request({
      userId,
      staffName,
      staffDepartment: user?.department || "-", // pastikan ada fallback
      requestType,
      details,
      approver,                 
      approverName: approverName || "-",       // dari frontend
      approverDepartment: approverDepartment || "-", // dari frontend
      file: req.file ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` : null, // full URL
      status: "Pending" // optional, default status
    });

    await newRequest.save();

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("❌ Error createRequest:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🟡 GET semua request
export const getRequestForPDF = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("userId", "department name email") // pastikan populate
      .populate("approver", "name department");

    if (!request) return res.status(404).json({ message: "Request not found" });

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔵 UPDATE status
export const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Request.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};