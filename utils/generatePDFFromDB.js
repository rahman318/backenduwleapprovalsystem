import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import Request from "../models/Requests.js";
import fetch from "node-fetch";
import fs from "fs";

/* ================= HELPERS ================= */

function drawLine(page, y) {
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
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
  const d = new Date(date);
  d.setHours(d.getHours() + 8);

  return d.toLocaleString("ms-MY", {
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

function wrapText(text, maxLength = 80) {
  if (!text) return ["-"];
  const words = text.split(" ");
  const lines = [];
  let current = "";

  words.forEach((w) => {
    if ((current + w).length > maxLength) {
      lines.push(current);
      current = w + " ";
    } else {
      current += w + " ";
    }
  });

  lines.push(current);
  return lines;
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

  /* ================= LOAD LOGO ================= */

  let logoImage = null;

  try {
    const logoBytes = fs.readFileSync("./assets/company logo.png");
    logoImage = await pdf.embedPng(logoBytes);
  } catch (err) {
    console.log("Logo tak jumpa bossskurrr");
  }

  /* ================= HEADER ================= */

  if (logoImage) {

    const dims = logoImage.scaleToFit(60, 60);

    page.drawImage(logoImage, {
      x: margin,
      y: y - 20,
      width: dims.width,
      height: dims.height,
    });
  }

  const headerX = margin + 80;

  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", {
    x: headerX,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.5),
  });

  y -= 20;

  page.drawText(
    "Pantai Chenang, 07000 Langkawi Kedah | 04-9556100",
    { x: headerX, y, size: 10, font }
  );

  y -= 25;

  page.drawText("BORANG PERMOHONAN", {
    x: headerX,
    y,
    size: 14,
    font: bold,
  });

  drawLine(page, y - 5);

  y -= 35;

  /* ================= REQUEST INFO ================= */

  page.drawText(`Nama Staff : ${request.staffName ?? "-"}`, { x: margin, y, size: 11, font });
  y -= 16;

  page.drawText(
    `Tarikh Permohonan : ${
      request.createdAt
        ? new Date(request.createdAt).toLocaleDateString("ms-MY")
        : "-"
    }`,
    { x: margin, y, size: 11, font }
  );

  y -= 16;

  page.drawText(`No Siri : ${request.serialNumber ?? "-"}`, { x: margin, y, size: 11, font });

  y -= 16;

  page.drawText(`Jenis Permohonan : ${request.requestType ?? "-"}`, {
    x: margin,
    y,
    size: 11,
    font,
  });

  y -= 25;

  /* ================= DETAILS ================= */

  page.drawText("BUTIRAN PERMOHONAN", {
    x: margin,
    y,
    size: 12,
    font: bold,
  });

  drawLine(page, y - 5);

  y -= 20;

  /* ================= PURCHASE TABLE ================= */

  if (request.requestType === "PEMBELIAN" && Array.isArray(request.items)) {

    const headers = ["Item", "Qty", "Harga (RM)", "Supplier", "Tujuan"];
    const widths = [150, 40, 70, 120, 140];

    let x = margin;

    headers.forEach((h, i) => {
      page.drawText(h, { x, y, size: 10, font: bold });
      x += widths[i];
    });

    y -= 16;

    request.items.forEach((item) => {

      let col = margin;

      page.drawText(item.itemName || "-", { x: col, y, size: 10, font });
      col += widths[0];

      page.drawText(`${item.quantity || 0}`, { x: col, y, size: 10, font });
      col += widths[1];

      page.drawText(`${item.estimatedCost || 0}`, { x: col, y, size: 10, font });
      col += widths[2];

      page.drawText(item.supplier || "-", { x: col, y, size: 10, font });
      col += widths[3];

      page.drawText(item.reason || "-", { x: col, y, size: 10, font });

      y -= 15;
    });

    y -= 10;
  }

  /* ================= TECHNICIAN REMARK ================= */

  if (request.technicianRemark?.trim()) {

    page.drawText("Catatan Technician:", {
      x: margin,
      y,
      size: 11,
      font: bold,
    });

    y -= 15;

    const lines = wrapText(request.technicianRemark);

    lines.forEach((l) => {
      page.drawText(l, { x: margin + 10, y, size: 11, font });
      y -= 14;
    });

    y -= 10;
  }

  /* ================= PROOF IMAGE ================= */

  if (request.proofImageUrl) {

    try {

      const resp = await fetch(request.proofImageUrl);
      const buf = Buffer.from(await resp.arrayBuffer());

      let img;

      if (request.proofImageUrl.match(/\.jpe?g$/i))
        img = await pdf.embedJpg(buf);
      else if (request.proofImageUrl.match(/\.png$/i))
        img = await pdf.embedPng(buf);

      if (img) {

        page.drawText("Proof of Work:", {
          x: margin,
          y,
          size: 11,
          font: bold,
        });

        y -= 15;

        const width = 220;
        const height = (img.height / img.width) * width;

        page.drawImage(img, {
          x: margin,
          y: y - height,
          width,
          height,
        });

        y -= height + 20;
      }

    } catch (err) {
      console.log("Gagal load proof image");
    }
  }

  /* ================= STATUS ================= */

  const approvals = Array.isArray(request.approvals) ? request.approvals : [];

  const statuses = approvals.map(a => a.status?.toUpperCase()).filter(Boolean);

  let mainStatus = "-";

  if (statuses.includes("REJECTED")) mainStatus = "DITOLAK";
  else if (statuses.length && statuses.every(s => s === "APPROVED"))
    mainStatus = "LULUS";

  page.drawText(`Status Permohonan : ${mainStatus}`, {
    x: margin,
    y,
    size: 12,
    font: bold,
    color:
      mainStatus === "DITOLAK"
        ? rgb(0.8, 0.1, 0.1)
        : mainStatus === "LULUS"
        ? rgb(0.1, 0.6, 0.2)
        : rgb(0, 0, 0),
  });

  y -= 40;

  /* ================= SIGNATURE ================= */

  const sigStaffW = 180;
  const sigStaffH = 60;

  page.drawText("Pemohon", { x: margin, y, size: 10, font: bold });

  page.drawLine({
    start: { x: margin, y: y - sigStaffH },
    end: { x: margin + sigStaffW, y: y - sigStaffH },
    thickness: 1,
  });

  if (request.signatureStaff?.includes(",")) {

    const img = await embedPngFromBase64(
      pdf,
      request.signatureStaff.split(",")[1]
    );

    page.drawImage(img, {
      x: margin,
      y: y - sigStaffH,
      width: sigStaffW,
      height: sigStaffH,
    });
  }

  let x = margin + sigStaffW + 20;

  approvals.forEach(async (a, i) => {

    const sigW = 120;
    const sigH = 50;

    page.drawText(`Level ${i + 1}`, { x, y, size: 9, font: bold });

    page.drawText(a?.approverName ?? "-", { x, y: y - 12, size: 9, font });

    page.drawText(`Status: ${a?.status ?? "-"}`, {
      x,
      y: y - 22,
      size: 8,
      font,
    });

    page.drawText(`Tarikh: ${formatDateTime(getActionDate(a))}`, {
      x,
      y: y - 32,
      size: 8,
      font,
    });

    page.drawLine({
      start: { x, y: y - sigH },
      end: { x: x + sigW, y: y - sigH },
      thickness: 1,
    });

    if (a?.signature?.includes(",")) {

      const img = await embedPngFromBase64(
        pdf,
        a.signature.split(",")[1]
      );

      page.drawImage(img, {
        x,
        y: y - sigH,
        width: sigW,
        height: sigH,
      });
    }

    x += sigW + 20;
  });

  /* ================= WATERMARK ================= */

  if (mainStatus !== "-") {

    page.drawText(mainStatus, {
      x: 120,
      y: 400,
      size: 90,
      font: bold,
      rotate: degrees(-25),
      opacity: 0.15,
      color:
        mainStatus === "DITOLAK"
          ? rgb(0.8, 0.1, 0.1)
          : rgb(0.1, 0.6, 0.2),
    });
  }

  /* ================= FOOTER ================= */

  page.drawText(
    "Dokumen ini dijana secara automatik oleh Sistem e-Approval",
    {
      x: margin,
      y: 40,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  return await pdf.save({ useObjectStreams: false });
}

