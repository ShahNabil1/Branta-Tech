import type { PdfQuote } from "./phase5";
import { pdfMoney } from "./phase5";
import { BRANTA_LIGHT_LOGO } from "@/lib/brand-media";

/** Browser-only: renders a saved quotation version to a multi-page A4 PDF and downloads it. */
export async function downloadQuotePdf(d: PdfQuote) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48;
  const ORANGE: [number, number, number] = [255, 93, 0], INK: [number, number, number] = [36, 22, 15], MUTED: [number, number, number] = [111, 91, 80];
  let y = M;

  try {
    const img = await loadImage(BRANTA_LIGHT_LOGO);
    const h = 24, w = (img.width / img.height) * h;
    doc.addImage(img, "PNG", M, y, w, h);
  } catch { doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...INK).text(d.company.name, M, y + 18); }
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  [d.company.name, d.company.email, d.company.phone].filter(Boolean).forEach((t, i) => doc.text(String(t), W - M, y + 6 + i * 12, { align: "right" }));
  y += 52;
  doc.setDrawColor(...ORANGE).setLineWidth(2).line(M, y, W - M, y);
  y += 28;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ORANGE).text("QUOTATION", M, y);
  doc.setFontSize(20).setTextColor(...INK).text(d.reference, M, y + 22);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED)
    .text(`Version ${d.version} · Issued ${new Date(d.issuedAt).toLocaleDateString("en-GB")}${d.validUntil ? ` · Valid until ${d.validUntil}` : ""}`, M, y + 38);
  y += 64;

  const col = (title: string, rows: string[], x: number) => {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED).text(title.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    rows.forEach((r, i) => doc.text(r, x, y + 16 + i * 14, { maxWidth: (W - 2 * M) / 2 - 12 }));
    return rows.length;
  };
  const p = d.production;
  const prod = [p.videoType && `Video type: ${p.videoType}`, p.model && `AI model: ${p.model}`, p.tier && `Production tier: ${p.tier}`, p.durationSeconds && `Duration: ${p.durationSeconds} seconds`, p.addons.length && `Add-ons: ${p.addons.join(", ")}`].filter(Boolean) as string[];
  const n = Math.max(col("Prepared for", [d.customer.name, d.customer.company, d.customer.email].filter(Boolean) as string[], M), (d.photoSpecs ? col("Photography specifications", d.photoSpecs, W / 2 + 6) : col("AI production specifications", prod.length ? prod : ["Custom production"], W / 2 + 6)));
  y += 24 + n * 14;

  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 56 },
    head: [["Item", "Qty", "Unit", "Amount"]],
    body: d.lines.map((l) => [l.label, String(l.quantity), pdfMoney(l.unit_minor, d.currency), pdfMoney(l.amount_minor, d.currency)]),
    styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: 6, lineColor: [234, 223, 216], lineWidth: 0.5 },
    headStyles: { fillColor: [255, 248, 243], textColor: MUTED, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 44 }, 2: { halign: "right", cellWidth: 100 }, 3: { halign: "right", cellWidth: 100 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  const totals: [string, string, boolean?][] = [["Subtotal", pdfMoney(d.subtotal, d.currency)]];
  if (d.discount > 0) totals.push(["Discount", `- ${pdfMoney(d.discount, d.currency)}`]);
  if (d.tax) totals.push([`${d.tax.label} ${d.tax.percentage}%${d.tax.inclusive ? " (included)" : ""}`, pdfMoney(d.tax.amount, d.currency)]);
  totals.push(["Total", pdfMoney(d.total, d.currency), true]);
  for (const [k, v, strong] of totals) {
    y = ensure(doc, y, 20, H, M);
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 12 : 10).setTextColor(...(strong ? INK : MUTED)).text(k, W - M - 220, y);
    doc.setTextColor(...INK).text(v, W - M, y, { align: "right" });
    y += strong ? 22 : 16;
  }
  y += 10;

  const section = (title: string, body: string | null) => {
    if (!body?.trim()) return;
    const lines = doc.setFont("helvetica", "normal").setFontSize(10).splitTextToSize(body.trim(), W - 2 * M) as string[];
    y = ensure(doc, y, 34, H, M);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED).text(title.toUpperCase(), M, y);
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    for (const l of lines) { y = ensure(doc, y, 14, H, M); doc.text(l, M, y); y += 14; }
    y += 12;
  };
  section("Project scope", d.scope);
  section("Deliverables", d.deliverables);
  section("Timeline", d.timeline);
  section("Revision policy", d.revisions != null ? `${d.revisions} revision round${d.revisions === 1 ? "" : "s"} included.` : null);
  section("Payment terms", d.paymentTerms);
  section("Validity", d.validUntil ? `This quotation is valid until ${d.validUntil}.` : null);
  section("Notes", d.notes);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(234, 223, 216).setLineWidth(0.5).line(M, H - 40, W - M, H - 40);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED)
      .text(`${d.company.name} · ${d.reference} v${d.version}`, M, H - 26)
      .text(`Page ${i} of ${pages}`, W - M, H - 26, { align: "right" });
  }
  doc.save(`${d.reference}-v${d.version}.pdf`);
}

function ensure(doc: { addPage: () => unknown }, y: number, need: number, H: number, M: number) {
  if (y + need > H - 56) { doc.addPage(); return M; }
  return y;
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
