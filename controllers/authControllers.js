import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/user.js";
import Brevo from "@getbrevo/brevo";

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
 🟢 FORGOT PASSWORD (pakai Brevo API, tanpa template)
===================================================== */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Sila masukkan emel anda" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Pengguna tidak dijumpai" });

    // Jana token reset
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHashed = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHashed;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // ⬅️ fixed nama field
    await user.save({ validateBeforeSave: false });

    // Link reset (frontend route)
    const resetUrl = `https://uwleapprovalsystem.onrender.com/reset-password/${resetToken}`;

    // Hantar email pakai Brevo API
    const brevoClient = new Brevo.TransactionalEmailsApi();
    brevoClient.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    await brevoClient.sendTransacEmail({
      sender: { name: "e-Approval System", email: "admin@uwleapprovalsystem.com" },
      to: [{ email: user.email }],
      subject: "Reset Kata Laluan e-Approval",
      htmlContent: `
        <h3>Reset Kata Laluan</h3>
        <p>Anda menerima emel ini kerana anda telah meminta reset kata laluan akaun anda.</p>
        <p>Klik pautan di bawah untuk reset kata laluan anda (sah selama 10 minit):</p>
        <a href="${resetUrl}">Reset Kata Laluan</a>
      `,
    });

    res.status(200).json({ message: "Emel reset kata laluan telah dihantar" });
  } catch (err) {
    console.error("❌ Ralat forgotPassword:", err);
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
      resetPasswordExpires: { $gt: Date.now() }, // ⬅️ fixed nama field
    });

    if (!user)
      return res
        .status(400)
        .json({ message: "Token tidak sah atau telah tamat tempoh" });

    // Tukar kata laluan baru
    user.password = password; // pre-save hook auto-hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    /* ================================
       ✅ Hantar email notifikasi berjaya
    =================================== */
    try {
      const brevoClient = new Brevo.TransactionalEmailsApi();
      brevoClient.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        process.env.BREVO_API_KEY
      );

      await brevoClient.sendTransacEmail({
        sender: {
          name: "e-Approval System",
          email: "admin@uwleapprovalsystem.com",
        },
        to: [{ email: user.email }],
        subject: "Kata Laluan Berjaya Ditukar",
        htmlContent: `
          <h3>Berjaya!</h3>
          <p>Hai ${user.name},</p>
          <p>Kata laluan akaun anda telah berjaya ditukar.</p>
          <p>Jika anda tidak melakukan perubahan ini, sila hubungi admin dengan segera.</p>
        `,
      });
    } catch (emailErr) {
      console.log("⚠️ Gagal hantar emel notifikasi:", emailErr.message);
    }

    res.status(200).json({ message: "Kata laluan berjaya ditetapkan semula" });
  } catch (err) {
    console.error("❌ Ralat resetPassword:", err);
    res.status(500).json({ message: "Ralat pelayan", error: err.message });
  }
};

