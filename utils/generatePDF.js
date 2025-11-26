// utils/generatePDF.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export async function generateRequestPDF(request) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const { width } = page.getSize();
  const margin = 50;
  let y = 800;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---------------- HEADER PREMIUM ----------------
  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.5) });
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: rgb(0.1, 0.1, 0.5) });
  y -= 25;

  // ---------------- TITLE PREMIUM ----------------
  let title = "";
  switch (request.requestType) {
    case "Pembelian":
      title = "BORANG PERMOHONAN PEMBELIAN";
      break;
    case "Cuti":
      title = "BORANG PERMOHONAN CUTI";
      break;
    default:
      title = `PERMOHONAN ${request.requestType?.toUpperCase() || "-"}`;
  }

  page.drawRectangle({
    x: margin - 5,
    y: y - 5,
    width: width - margin * 2 + 10,
    height: 22,
    color: rgb(0.9, 0.9, 1),
  });
  page.drawText(title, { x: margin, y, size: 13, font: bold, color: rgb(0.1, 0.1, 0.5) });
  y -= 30;

  // ---------------- STAFF INFO ----------------
  const sectionBackground = rgb(0.95, 0.95, 0.95);
  function drawSectionHeading(text) {
    page.drawRectangle({ x: margin - 5, y: y - 5, width: width - margin * 2 + 10, height: 20, color: sectionBackground });
    page.drawText(text, { x: margin, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
    y -= 25;
  }

  drawSectionHeading("Maklumat Staff");

  // ✅ fallback: ambil department dari userId populate kalau staffDepartment kosong
  const staffDept = request.staffDepartment && request.staffDepartment !== "-"
    ? request.staffDepartment
    : request.userId?.department || "-";

  page.drawText(`Nama: ${request.staffName || "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Jabatan / Unit: ${staffDept}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Tarikh Permohonan: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString("ms-MY") : "-"}`, { x: margin, y, size: 11, font });
  y -= 20;

  // ---------------- CONTENT BERBEZA ----------------
  if (request.requestType === "Pembelian") {
    drawSectionHeading("Senarai Barang");

    const tableX = margin;
    const rowHeight = 22;
    const headers = ["Bil", "Nama Barang", "Kuantiti", "Catatan"];
    const colWidths = [40, 260, 80, 120];

    // Header
    page.drawRectangle({
      x: tableX,
      y,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      color: rgb(0.9, 0.9, 1),
      borderColor: rgb(0.1, 0.1, 0.5),
      borderWidth: 1,
    });
    headers.forEach((header, i) => {
      page.drawText(header, {
        x: tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5,
        y: y + 6,
        size: 10,
        font: bold,
        color: rgb(0.1, 0.1, 0.5),
      });
    });
    y -= rowHeight;

    const items = request.items || [];
    items.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? rgb(1,1,1) : rgb(0.95,0.95,0.98);
      page.drawRectangle({
        x: tableX,
        y,
        width: colWidths.reduce((a,b)=>a+b,0),
        height: rowHeight,
        color: rowColor,
      });

      const row = [String(index + 1), item.itemName || "-", String(item.quantity || "-"), item.remarks || "-"];
      row.forEach((text, i) => {
        page.drawText(text, {
          x: tableX + colWidths.slice(0, i).reduce((a,b)=>a+b,0) + (i === 0 || i === 2 ? colWidths[i]/2 - (text.length*2) : 5),
          y: y + 6,
          size: 10,
          font,
          color: rgb(0,0,0),
        });
      });
      y -= rowHeight;
    });

    y -= 15;
  } else if (request.requestType === "Cuti") {
    drawSectionHeading("Maklumat Cuti");
    page.drawText(`Tempoh: ${request.leaveStart ? new Date(request.leaveStart).toLocaleDateString("ms-MY") : "-"} - ${request.leaveEnd ? new Date(request.leaveEnd).toLocaleDateString("ms-MY") : "-"}`, { x: margin, y, size: 11, font });
    y -= 16;
    page.drawText(`Butiran: ${request.details || "-"}`, { x: margin, y, size: 11, font });
    y -= 15;
  } else {
    drawSectionHeading("Butiran Permohonan");
    page.drawText(`${request.details || "-"}`, { x: margin, y, size: 11, font });
    y -= 15;
  }

  // ---------------- APPROVER INFO ----------------
  drawSectionHeading("Maklumat Approver");
  page.drawText(`Status: ${request.status || "Pending"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Nama: ${request.approverName || "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Jabatan / Unit: ${request.approverDepartment || "-"}`, { x: margin, y, size: 11, font });
  y -= 30;

// 🟢 Signature Staff
const sigWidth = 150;
const sigHeight = 50;
const sigY = y - 40; // letak signature di bawah content
const labelOffset = 12; // jarak untuk label

if (request.signatureStaff) {
  const staffSigImage = await pdf.embedPng(request.signatureStaff);
  page.drawText("Staff Signature", { x: margin, y: sigY + sigHeight + 5, size: 10, font, color: rgb(0,0,0) });
  page.drawImage(staffSigImage, {
    x: margin,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
  });
}

if (request.signatureApprover) {
  const approverSigImage = await pdf.embedPng(request.signatureApprover);
  page.drawText("Approver Signature", { x: width - margin - sigWidth, y: sigY + sigHeight + 5, size: 10, font, color: rgb(0,0,0) });
  page.drawImage(approverSigImage, {
    x: width - margin - sigWidth,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
  });
}

  // ---------------- QR CODE ----------------
  const qrData = `Request ID: ${request._id}`;
  const qrImageData = await QRCode.toDataURL(qrData);
  const qrImage = await pdf.embedPng(qrImageData);
  page.drawImage(qrImage, { x: width - 130, y: 70, width: 80, height: 80 });

  // ---------------- FOOTER PREMIUM ----------------
  page.drawRectangle({ x: margin - 5, y: 50, width: width - margin*2 + 10, height: 20, color: rgb(0.9,0.9,1) });
  page.drawText("Dokumen ini dijana secara automatik melalui Sistem e-Approval.", {
    x: margin,
    y: 55,
    size: 8,
    font,
    color: rgb(0.1,0.1,0.5)
  });

  return await pdf.save();
}