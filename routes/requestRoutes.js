// backend/routes/requestRoutes.js
import express from "express";
import { createRequest, updateRequestStatus, approveRequest, getRequestPDF } from "../controllers/requestController.js";
import Request from "../models/Requests.js";
import upload from "../Middleware/upload.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import { generateRequestPDF } from "../utils/generatePDF.js";
import { getPDFforRequest } from "../controllers/requestController.js";

const router = express.Router();

// CREATE
router.post("/", upload.single("file"), createRequest);

// GET all dengan populate
router.get("/", async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("userId", "name department")
      .populate("approver", "name role email department");
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Error fetch requests" });
  }
});

// UPDATE status
router.patch("/:id", updateRequestStatus);

// PUT /api/requests/approve/:id
router.put("/approve/:id", authMiddleware, approveRequest);

// PDF - generate on-demand
router.get("/:id/pdf", async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("userId", "name department")
      .populate("approver", "name department");

    if (!request) return res.status(404).json({ message: "Request tidak ditemui" });

    const pdfBytes = await generateRequestPDF({
      ...request.toObject(),
      staffName: request.userId?.name || request.staffName,
      department: request.userId?.department || request.department,
      approverName: request.approver?.name || "-",
      approverDepartment: request.approver?.department || "-",
      requestType: request.requestType,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=request_${request._id}.pdf`
    );
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ PDF generate error:", err);
    res.status(500).json({ message: "Gagal generate PDF" });
  }
});


export default router;
