import AuditLog from "../models/AuditLog.js";

export const logAction = async ({
  action,
  user,
  requestId,
  details,
  ipAddress,
}) => {
  try {
    await AuditLog.create({
      action,
      user: user?.name || "Unknown",
      role: user?.role || "Unknown",
      requestId,
      details,
      ipAddress: ipAddress || "N/A",
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
};
