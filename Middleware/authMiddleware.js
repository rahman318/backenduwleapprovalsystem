import jwt from "jsonwebtoken";
import User from "../models/user.js";

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token

  console.log("🔑 Incoming Auth Request");
  console.log("➡️ Headers:", req.headers.authorization);

  if (!token) {
    console.log("❌ Tiada token dihantar!");
    return res.status(401).json({ message: "Unauthorized - No Token" });
  }

  try {
    console.log("✅ Token diterima:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    console.log("📦 Decoded JWT:", decoded);

    const user = await User.findById(decoded.id).select("-password");
    console.log("👤 User dari DB:", user ? user.name : "❌ User not found");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    req.user = user;
    console.log("✅ Auth success untuk:", user.name, "| Role:", user.role);

    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ message: "Token invalid" });
  }
};


export default authMiddleware;

