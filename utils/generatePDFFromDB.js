// utils/generatePDFWithLogo.js
import fs from "fs";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import Request from "../models/Requests.js";

/* ================= HELPERS ================= */
function drawLineBelowText(page, y, startX = 50, endX = 545, offset = 5, thickness = 0.8) {
  page.drawLine({
    start: { x: startX, y: y - offset },
    end: { x: endX, y: y - offset },
    thickness,
    color: rgb(0.6, 0.6, 0.6),
  });
}

function cleanBase64(b64) {
  return b64.replace(/\s/g, "");
}

async function embedPngFromBase64(pdf, base64) {
  const bytes = Buffer.from(cleanBase64(base64), "base64");
  return await pdf.embedPng(bytes);
}

function formatDateTime(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getActionDate(a) {
  return a?.approvedAt || a?.actionDate || a?.updatedAt || null;
}

/* ================= MAIN ================= */
export async function generatePDFWithLogo(requestId) {
  const request = await Request.findById(requestId).lean();
  if (!request) throw new Error("Request tak jumpa bossskurrr!");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 800;

  /* ========== HEADER ========== */
  const headerX = margin + 70;
  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", { x: headerX, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.5) });
  y -= 20;
  page.drawText("PANTAI CHENANG 07000 LANGKAWI KEDAH | 04-9556100", { x: headerX, y, size: 10, font });
  y -= 25;
  page.drawText("BORANG PERMOHONAN", { x: headerX, y, size: 14, font: bold });
  drawLineBelowText(page, y, margin, 545, 7, 1.2);
  y -= 30;

  /* ========== INFO ========== */
  page.drawText(`Nama Staff: ${request.staffName ?? "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Tarikh Permohonan: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString("ms-MY") : "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`No. Siri: ${request.serialNumber ?? "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Jenis Permohonan: ${request.requestType ?? "-"}`, { x: margin, y, size: 11, font });
  y -= 25;

  /* ========== DETAILS ========== */
  page.drawText("Butiran Permohonan:", { x: margin, y, size: 12, font: bold });
  drawLineBelowText(page, y, margin, 545, 4);
  y -= 18;

  if (request.requestType === "PEMBELIAN" && Array.isArray(request.items) && request.items.length) {
    // ===== PEMBELIAN =====
    const headers = ["Nama Item", "Qty", "Harga (RM)", "Pembekal", "Tujuan"];
    const colWidths = [150, 40, 70, 120, 140];
    let startX = margin;

    headers.forEach((h, i) => {
      page.drawText(h, { x: startX, y, size: 10, font: bold });
      startX += colWidths[i];
    });
    y -= 16;

    request.items.forEach((item) => {
      let x = margin;
      page.drawText(item.itemName || "-", { x, y, size: 10, font });
      x += colWidths[0];
      page.drawText(`${item.quantity || 0}`, { x, y, size: 10, font });
      x += colWidths[1];
      page.drawText(`${item.estimatedCost || 0}`, { x, y, size: 10, font });
      x += colWidths[2];
      page.drawText(item.supplier || "-", { x, y, size: 10, font });
      x += colWidths[3];
      page.drawText(item.reason || "-", { x, y, size: 10, font });
      y -= 16;
    });

  } else if (request.requestType === "CUTI") {
    // ===== CUTI =====
    let leaveDetailsObj = {};
    try {
      if (request.leaveDetails) {
        leaveDetailsObj = typeof request.leaveDetails === "string" ? JSON.parse(request.leaveDetails) : request.leaveDetails;
      } else if (request.details) {
        leaveDetailsObj = typeof request.details === "string" ? JSON.parse(request.details) : request.details;
      }
    } catch (e) {
      console.log("Gagal parse leaveDetails:", e);
    }

    for (const [key, value] of Object.entries(leaveDetailsObj)) {
      page.drawText(`${key}:`, { x: margin, y, size: 11, font: bold });
      page.drawText(String(value ?? "-"), { x: margin + 160, y, size: 11, font });
      y -= 16;
    }

  } else if (request.requestType === "IT_SUPPORT") {
    // ===== IT SUPPORT =====
    let itDetailsObj = {};
    try {
      if (request.itDetails) {
        itDetailsObj = typeof request.itDetails === "string" ? JSON.parse(request.itDetails) : request.itDetails;
      } else if (request.details) {
        itDetailsObj = typeof request.details === "string" ? JSON.parse(request.details) : request.details;
      }
    } catch (e) {
      console.log("Gagal parse IT details:", e);
    }

    for (const [key, value] of Object.entries(itDetailsObj)) {
      page.drawText(`${key}:`, { x: margin, y, size: 11, font: bold });
      page.drawText(String(value ?? "-"), { x: margin + 160, y, size: 11, font });
      y -= 16;
    }

  } else if (request.requestType === "Maintenance") {
    // ===== MAINTENANCE =====
    let maintenanceDetails = {};
    try {
      maintenanceDetails = typeof request.details === "string" ? JSON.parse(request.details) : request.details;
    } catch (e) {
      console.log("Gagal parse Maintenance details:", e);
    }

    page.drawText(`Lokasi Kerosakan:`, { x: margin, y, size: 11, font: bold });
    page.drawText(`${maintenanceDetails.location ?? "-"}`, { x: margin + 160, y, size: 11, font });
    y -= 16;

    page.drawText(`Jenis Masalah:`, { x: margin, y, size: 11, font: bold });
    page.drawText(`${maintenanceDetails.issueType ?? "-"}`, { x: margin + 160, y, size: 11, font });
    y -= 16;

    page.drawText(`Keutamaan:`, { x: margin, y, size: 11, font: bold });
    page.drawText(`${maintenanceDetails.priority ?? "-"}`, { x: margin + 160, y, size: 11, font });
    y -= 16;

    page.drawText(`Penerangan Masalah:`, { x: margin, y, size: 11, font: bold });
    page.drawText(`${maintenanceDetails.description ?? "-"}`, { x: margin + 160, y, size: 11, font });
    y -= 16;

  } else {
    page.drawText("-", { x: margin, y, size: 11, font });
    y -= 16;
  }

  /* ========== STATUS ========== */
  const approvals = Array.isArray(request.approvals) ? request.approvals : [];
  const statuses = approvals.map(a => a.status?.toUpperCase()).filter(Boolean);
  let mainStatus = "-";
  if (statuses.includes("REJECTED")) mainStatus = "DITOLAK";
  else if (statuses.length && statuses.every(s => s === "APPROVED")) mainStatus = "LULUS";

  page.drawText(`Status Permohonan: ${mainStatus}`, {
    x: margin,
    y,
    size: 12,
    font: bold,
    color: mainStatus === "DITOLAK" ? rgb(0.8, 0.1, 0.1) : mainStatus === "LULUS" ? rgb(0.1, 0.6, 0.2) : rgb(0, 0, 0),
  });

  y -= 30;

  /* ========== SIGNATURES ========== */
  const sigStaffW = 180, sigStaffH = 60, sigAppW = 120, sigAppH = 50, gap = 20;

  page.drawText("Pemohon", { x: margin, y, size: 10, font: bold });
  page.drawLine({ start: { x: margin, y: y - sigStaffH - 2 }, end: { x: margin + sigStaffW, y: y - sigStaffH - 2 }, thickness: 1 });
  if (typeof request.signatureStaff === "string" && request.signatureStaff.includes(",")) {
    const img = await embedPngFromBase64(pdf, request.signatureStaff.split(",")[1]);
    page.drawImage(img, { x: margin, y: y - sigStaffH, width: sigStaffW, height: sigStaffH });
  }

  let x = margin + sigStaffW + gap;
  for (let i = 0; i < approvals.length; i++) {
    const a = approvals[i];
    page.drawText(`Level ${i + 1}`, { x, y, size: 9, font: bold });
    page.drawText(a?.approverName ?? "-", { x, y: y - 12, size: 9, font });
    page.drawText(`Status: ${a?.status ?? "-"}`, { x, y: y - 22, size: 8, font });
    page.drawText(`Tarikh: ${formatDateTime(getActionDate(a))}`, { x, y: y - 32, size: 8, font });
    page.drawLine({ start: { x, y: y - sigAppH - 18 }, end: { x: x + sigAppW, y: y - sigAppH - 18 }, thickness: 1 });
    if (typeof a?.signature === "string" && a.signature.includes(",")) {
      const img = await embedPngFromBase64(pdf, a.signature.split(",")[1]);
      page.drawImage(img, { x, y: y - sigAppH, width: sigAppW, height: sigAppH });
    }
    x += sigAppW + gap;
  }

  /* ========== WATERMARK ========== */
  if (mainStatus !== "-") {
    page.drawText(mainStatus, { x: 60, y: 350, size: 100, font: bold, rotate: degrees(-25), opacity: 0.15, color: mainStatus === "DITOLAK" ? rgb(0.8,0.1,0.1) : rgb(0.1,0.6,0.2) });
  }

  /* ========== FOOTER ========== */
  page.drawText("Dokumen ini dijana secara automatik oleh Sistem e-Approval", { x: margin, y: 40, size: 8, font, color: rgb(0.4,0.4,0.4) });

  return await pdf.save({ useObjectStreams: false });
}
