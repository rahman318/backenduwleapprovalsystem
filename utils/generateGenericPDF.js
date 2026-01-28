import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

/* ===============================
   HELPER
================================ */

function drawLineBelowText(page, y, startX = 50, endX = 545, offset = 5, thickness = 0.8) {
  page.drawLine({
    start: { x: startX, y: y - offset },
    end: { x: endX, y: y - offset },
    thickness,
    color: rgb(0.6, 0.6, 0.6),
  });
}

async function embedPngFromBase64(pdf, base64) {
  const clean = base64.replace(/\s/g, "");
  const bytes = Buffer.from(clean, "base64");
  return await pdf.embedPng(bytes);
}

/* ===============================
   MAIN PDF (FIXED)
================================ */

export async function generateGenericPDF(request) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 800;

  /* ===============================
     LOGO
  ================================ */
  const logoPath = path.resolve("backend/logo.png");
  let logoWidth = 0;

  if (fs.existsSync(logoPath)) {
    const logoBytes = fs.readFileSync(logoPath);
    const logo = await pdf.embedPng(logoBytes);

    const maxW = 90;
    const scale = Math.min(maxW / logo.width, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;

    logoWidth = w;

    page.drawImage(logo, {
      x: margin,
      y: y - h,
      width: w,
      height: h,
    });
  }

  /* ===============================
     HEADER
  ================================ */
  const headerX = margin + (logoWidth ? logoWidth + 20 : 0);

  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", {
    x: headerX,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.5),
  });

  y -= 20;
  page.drawText("PANTAI CHENANG 07000 LANGKAWI KEDAH | 04-9556100", {
    x: headerX,
    y,
    size: 10,
    font,
  });

  y -= 25;
  page.drawText("BORANG PERMOHONAN", {
    x: headerX,
    y,
    size: 14,
    font: bold,
  });

  drawLineBelowText(page, y, margin, 545, 7, 1.2);
  y -= 35;

  /* ===============================
     INFO
  ================================ */
  page.drawText(`Nama Staff: ${request?.staffName ?? "-"}`, { x: margin, y, size: 11, font });
  y -= 16;

  page.drawText(
    `Tarikh Permohonan: ${
      request?.createdAt
        ? new Date(request.createdAt).toLocaleDateString("ms-MY")
        : "-"
    }`,
    { x: margin, y, size: 11, font }
  );

  y -= 16;
  page.drawText(`Jenis Permohonan: ${request?.requestType ?? "-"}`, {
    x: margin,
    y,
    size: 11,
    font,
  });

  y -= 28;

  /* ===============================
     BUTIRAN (FIX UTAMA)
  ================================ */
  page.drawText("Butiran Permohonan:", { x: margin, y, size: 12, font: bold });
  drawLineBelowText(page, y, margin, 545, 4);
  y -= 20;

  let detailEntries = [];

  if (request?.requestType === "CUTI" && request.leaveDetails) {
    detailEntries = Object.entries(request.leaveDetails);

  } else if (request?.requestType === "IT SUPPORT" && request.itDetails) {
    detailEntries = Object.entries(request.itDetails);

  } else if (request?.details && typeof request.details === "object") {
    detailEntries = Object.entries(request.details);

  } else {
    detailEntries = [["Maklumat", "-"]];
  }

  for (const [key, value] of detailEntries) {
    page.drawText(`${key}:`, { x: margin, y, size: 11, font: bold });
    page.drawText(String(value ?? "-"), {
      x: margin + 150,
      y,
      size: 11,
      font,
    });
    y -= 16;
  }

  y -= 20;

  /* ===============================
     STATUS
  ================================ */
  const approvals = Array.isArray(request?.approvals) ? request.approvals : [];

  let statusText = "-";
  if (approvals.some(a => a?.status === "Rejected")) statusText = "DITOLAK";
  else if (approvals.length && approvals.every(a => a?.status === "Approved"))
    statusText = "LULUS";

  page.drawText(`Status Permohonan: ${statusText}`, {
    x: margin,
    y,
    size: 12,
    font: bold,
    color:
      statusText === "DITOLAK"
        ? rgb(0.8, 0.1, 0.1)
        : statusText === "LULUS"
        ? rgb(0.1, 0.6, 0.2)
        : rgb(0, 0, 0),
  });

  y -= 35;

  /* ===============================
     SIGNATURES
  ================================ */
  const sigW = 170;
  const sigH = 55;
  const gap = 25;

  page.drawText("Pemohon", { x: margin, y, size: 10, font: bold });
  page.drawLine({
    start: { x: margin, y: y - sigH - 2 },
    end: { x: margin + sigW, y: y - sigH - 2 },
    thickness: 1,
  });

  if (typeof request?.signatureStaff === "string" && request.signatureStaff.includes(",")) {
    const img = await embedPngFromBase64(pdf, request.signatureStaff.split(",")[1]);
    page.drawImage(img, { x: margin, y: y - sigH, width: sigW, height: sigH });
  }

  let x = margin + sigW + gap;

  for (let i = 0; i < approvals.length; i++) {
    const a = approvals[i];
    page.drawText(`Level ${i + 1}`, { x, y, size: 9, font: bold });
    page.drawText(a?.approverName ?? "-", { x, y: y - 12, size: 9, font });
    page.drawText(`Status: ${a?.status ?? "-"}`, { x, y: y - 22, size: 8, font });

    page.drawLine({
      start: { x, y: y - sigH - 10 },
      end: { x: x + sigW, y: y - sigH - 10 },
      thickness: 1,
    });

    if (typeof a?.signature === "string" && a.signature.includes(",")) {
      const img = await embedPngFromBase64(pdf, a.signature.split(",")[1]);
      page.drawImage(img, { x, y: y - sigH, width: sigW, height: sigH });
    }

    x += sigW + gap;
  }

  /* ===============================
     WATERMARK
  ================================ */
  if (statusText !== "-") {
    page.drawText(statusText, {
      x: 60,
      y: 350,
      size: 100,
      font: bold,
      rotate: degrees(-25),
      opacity: 0.15,
      color:
        statusText === "DITOLAK"
          ? rgb(0.8, 0.1, 0.1)
          : rgb(0.1, 0.6, 0.2),
    });
  }

  /* ===============================
     FOOTER
  ================================ */
  page.drawText("Dokumen ini dijana secara automatik oleh Sistem e-Approval", {
    x: margin,
    y: 40,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdf.save({ useObjectStreams: false });
}
