import { PDFDocument, StandardFonts } from "pdf-lib";

export async function generateGenericPDF(request) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 50;

  page.drawText("UNDERWATER WORLD LANGKAWI SDN BHD", { x: margin, y, size: 14, font: bold });
  y -= 18;
  page.drawText("PANTAI CHENANG 07000 LANGKAWI KEDAH | 04-9556100", { x: margin, y, size: 10, font });
  y -= 30;

  page.drawText("BORANG PERMOHONAN", { x: margin, y, size: 13, font: bold });
  y -= 25;

  page.drawText(`Nama Staff: ${request.staffName}`, { x: margin, y, size: 11, font });
  y -= 18;
  page.drawText(`Tarikh Permohonan: ${new Date(request.createdAt).toLocaleDateString("ms-MY")}`, { x: margin, y, size: 11, font });
  y -= 18;
  page.drawText(`Jenis Permohonan: ${request.requestType}`, { x: margin, y, size: 11, font });
  y -= 35;

  page.drawText("Butiran:", { x: margin, y, size: 12, font: bold });
  y -= 18;
  page.drawText(request.details || "-", { x: margin, y, size: 11, font });

  y -= 35;
  page.drawText("Keputusan:", { x: margin, y, size: 12, font: bold });
  y -= 18;
  page.drawText(`Status: ${request.status}`, { x: margin, y, size: 11, font });
  y -= 18;
  page.drawText(`Approver: ${request.approver?.username || "-"}`, { x: margin, y, size: 11, font });

  return await pdf.save();
}