import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("performedBy.userId", "name email role") // ambil nama user
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};
