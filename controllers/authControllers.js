import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/user.js";

/* =====================================================
 🟢 REGISTER USER
===================================================== */
export const registerUser = async (req, res) => {
  console.log("📩 Register request body:", req.body);

  try {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role) {
      console.log("❌ Missing fields:", { name, email, password, role });
      return res
        .status(400)
        .json({ message: "Sila isi semua medan yang diperlukan" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("⚠️ User already exists:", email);
      return res.status(400).json({ message: "Pengguna sudah wujud" });
    }

    const user = await User.create({
      name,
      email,
      password, // auto-hash melalui pre("save")
      role,
      department,
    });

    console.log("✅ User registered:", user.email);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Ralat pelayan", error: err.message });
  }
};

/* =====================================================
 🟡 LOGIN USER
===================================================== */
export const loginUser = async (req, res) => {
  console.log("📩 Login request body:", req.body);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ Missing login fields:", { email, password });
      return res
        .status(400)
        .json({ message: "Sila masukkan emel dan kata laluan" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(401).json({ message: "Emel atau kata laluan salah" });
    }

    console.log("🔑 Checking password for:", email);
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Password mismatch for:", email);
      return res.status(401).json({ message: "Emel atau kata laluan salah" });
    }

    console.log("✅ Login success:", email);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Ralat pelayan", error: err.message });
  }
};

/* =====================================================
 🟢 FORGOT PASSWORD (Brevo)
===================================================== */
import Brevo from "@getbrevo/brevo"; // npm i @getbrevo/brevo

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "Sila masukkan emel anda" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(200).json({ // ❌ Jangan reveal user tak wujud
        message:
          "Jika emel wujud dalam sistem, pautan reset kata laluan telah dihantar.",
      });

    // 🔑 Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHashed = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordToken = resetTokenHashed;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minit
    await user.save({ validateBeforeSave: false });

    // 🔗 Link reset
    const resetUrl = `https://uwleapprovalsystem.onrender.com/reset-password/${resetToken}`;

    // ✅ Setup Brevo client
    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = {
      to: [{ email: user.email, name: user.username || user.name }],
      templateId: 1, // ganti dengan template Brevo boss
      params: {
        username: user.username || user.name,
        resetLink: resetUrl,
      },
      subject: "Reset Kata Laluan e-Approval",
    };

    try {
      await client.sendTransacEmail(sendSmtpEmail);
      console.log("📨 Brevo: reset password email sent to", user.email);
    } catch (emailErr) {
      console.error("❌ Brevo send email error:", emailErr.message);
      // Jangan throw supaya frontend tetap dapat response 200
    }

    res.status(200).json({
      message:
        "Jika emel wujud dalam sistem, pautan reset kata laluan telah dihantar.",
    });
  } catch (err) {
    console.error("❌ Ralat forgotPassword:", err.message);
    res.status(500).json({ message: "Ralat pelayan", error: err.message });
  }
};

/* =====================================================
 🟡 RESET PASSWORD
===================================================== */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const resetTokenHashed = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHashed,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(400)
        .json({ message: "Token tidak sah atau telah tamat tempoh" });

    // Tukar kata laluan baru
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: "Kata laluan berjaya ditetapkan semula" });
  } catch (err) {
    console.error("❌ Ralat resetPassword:", err);
    res.status(500).json({ message: "Ralat pelayan", error: err.message });
  }

};


