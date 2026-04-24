// utils/auditHelper.js
import AuditLog from "../models/AuditLog.js";

export const logAudit = async ({
  action,
  module,
  user,
  targetId,
  details,
  req
}) => {
  try {
    await AuditLog.create({
      action,
      module,
      performedBy: {
        userId: user?._id || null,
        name: user?.name || "Unknown",
        email: user?.email || "-",
        role: user?.role || "-",
      },
      targetId,
      details,
      ipAddress: req?.ip || req?.headers["x-forwarded-for"],
      userAgent: req?.headers["user-agent"],
    });
  } catch (err) {
    console.error("❌ Audit Log Error:", err.message);
  }
};
