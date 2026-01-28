// utils/generatePDF.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const generatePDF = async (request) => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const { width } = page.getSize();
  const margin = 50;
  let y = 800;

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---------------- HEADER ----------------
  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.5) });
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: rgb(0.1, 0.1, 0.5) });
  y -= 25;

  // ---------------- TITLE ----------------
  let title = "";
  switch (request.requestType?.toLowerCase()) {
    case "pembelian": title = "BORANG PERMOHONAN PEMBELIAN"; break;
    case "cuti": title = "BORANG PERMOHONAN CUTI"; break;
    default: title = `PERMOHONAN ${request.requestType?.toUpperCase() || "-"}`;
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
  function drawSectionHeading(text) {
    page.drawRectangle({ x: margin - 5, y: y - 5, width: width - margin * 2 + 10, height: 20, color: rgb(0.95,0.95,0.95) });
    page.drawText(text, { x: margin, y, size: 12, font: bold, color: rgb(0.2,0.2,0.2) });
    y -= 25;
  }

  drawSectionHeading("Maklumat Staff");

  const staffDept = request.staffDepartment && request.staffDepartment !== "-"
    ? request.staffDepartment
    : request.userId?.department || "-";

  page.drawText(`Nama: ${request.staffName || "-"}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Jabatan / Unit: ${staffDept}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Tarikh Permohonan: ${request.createdAt ? new Date(request.createdAt).toLocaleDateString("ms-MY") : "-"}`, { x: margin, y, size: 11, font });
  y -= 20;

  // ---------------- CONTENT ----------------
  if (request.requestType?.toLowerCase() === "pembelian") {
    drawSectionHeading("Senarai Barang");
    const tableX = margin;
    const rowHeight = 22;
    const headers = ["Bil", "Nama Barang", "Kuantiti", "Catatan"];
    const colWidths = [40, 260, 80, 120];

    page.drawRectangle({ x: tableX, y, width: colWidths.reduce((a,b)=>a+b,0), height: rowHeight, color: rgb(0.9,0.9,1) });
    headers.forEach((h,i) => page.drawText(h, { x: tableX + colWidths.slice(0,i).reduce((a,b)=>a+b,0) + 5, y: y+6, size: 10, font: bold, color: rgb(0.1,0.1,0.5) }));
    y -= rowHeight;

    const items = request.items || [];
    items.forEach((item, idx) => {
      page.drawRectangle({ x: tableX, y, width: colWidths.reduce((a,b)=>a+b,0), height: rowHeight, color: idx % 2 === 0 ? rgb(1,1,1) : rgb(0.95,0.95,0.98) });
      const row = [String(idx+1), item.itemName || "-", String(item.quantity || "-"), item.remarks || "-"];
      row.forEach((text,i) => page.drawText(text, { x: tableX + colWidths.slice(0,i).reduce((a,b)=>a+b,0)+5, y:y+6, size:10, font, color: rgb(0,0,0) }));
      y -= rowHeight;
    });
    y -= 15;
  } else if (request.requestType?.toLowerCase() === "cuti") {
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

  // ---------------- APPROVERS ----------------
  drawSectionHeading("Maklumat Approver");
  const approvals = request.approvals || [];
  for (const a of approvals) {
    if (y < 150) { page.addPage([595,842]); y = 800; }

    page.drawText(`Level ${a.level}: ${a.approverName || "-"} - Status: ${a.status || "-"}`, { x: margin, y, size: 11, font });
    y -= 16;

    // Signature safe embed
    if (a.signature && a.signature.startsWith("data:image")) {
      try {
        const base64Sig = a.signature.split(",")[1];
        const sigImg = await pdf.embedPng(Uint8Array.from(Buffer.from(base64Sig, "base64")));
        page.drawImage(sigImg, { x: margin + 20, y, width: 150, height: 50 });
        y -= 60;
      } catch (err) {
        console.warn("Gagal load signature", err);
        y -= 16;
      }
    }
  }

  // ---------------- QR CODE ----------------
  const qrDataURL = await QRCode.toDataURL(`Request ID: ${request._id}`);
  const qrBase64 = qrDataURL.split(",")[1];
  const qrImage = await pdf.embedPng(Uint8Array.from(Buffer.from(qrBase64, "base64")));
  page.drawImage(qrImage, { x: width - 130, y: 70, width: 80, height: 80 });

  // ---------------- FOOTER ----------------
  page.drawRectangle({ x: margin-5, y: 50, width: width-margin*2+10, height: 20, color: rgb(0.9,0.9,1) });
  page.drawText("Dokumen dijana secara automatik melalui Sistem e-Approval.", { x: margin, y:55, size:8, font, color: rgb(0.1,0.1,0.5) });

  // ---------------- RETURN ----------------
  return pdf.save(); // ✅ Uint8Array, safe to send to frontend
};

export default generatePDF;
