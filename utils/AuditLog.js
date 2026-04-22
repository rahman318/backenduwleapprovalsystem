import AuditLog from "../models/AuditLog.js";

export const logAction = async ({
  userId,
  action,
  description,
  module,
  req,
}) => {
  try {
    await AuditLog.create({
      userId,
      action,
      description,
      module,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
};