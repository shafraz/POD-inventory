import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ReportResult } from "@/lib/services/reports";

type Meta = { organization: string; system: string };

export async function toXlsx(report: ReportResult, meta: Meta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.system;
  wb.created = new Date();
  const multiSheet = report.sections.length > 1 && report.title.startsWith("Asset Record");
  const sheets = multiSheet ? report.sections.map((s, i) => ({ name: s.title ?? `Sheet${i + 1}`, sections: [s] })) : [{ name: report.title, sections: report.sections }];

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Report", { views: [{ state: "frozen", ySplit: 0 }] });
    const width = Math.max(...sheet.sections.map((s) => s.columns.length));
    ws.addRow([`${meta.organization} — ${report.title}`]).font = { bold: true, size: 14 };
    ws.addRow([report.subtitle]).font = { italic: true, color: { argb: "FF64748B" } };
    ws.addRow([]);
    let headerRowNumber = 0;
    for (const section of sheet.sections) {
      if (section.title && !multiSheet) {
        const r = ws.addRow([section.title]);
        r.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
      }
      const header = ws.addRow(section.columns.map((c) => c.label));
      if (!headerRowNumber) headerRowNumber = header.number;
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle" };
      });
      for (const row of section.rows) ws.addRow(section.columns.map((c) => row[c.key] ?? ""));
      if (!section.rows.length) ws.addRow(["No records"]).font = { italic: true, color: { argb: "FF94A3B8" } };
      ws.addRow([]);
    }
    const cols = sheet.sections.reduce((a, s) => (s.columns.length > a.length ? s.columns : a), sheet.sections[0]?.columns ?? []);
    for (let i = 0; i < width; i++) ws.getColumn(i + 1).width = cols[i]?.width ?? 16;
    if (sheet.sections.length === 1 && headerRowNumber) {
      ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
      ws.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: sheet.sections[0].columns.length } };
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Guard against spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(report: ReportResult): string {
  const lines: string[] = [];
  const multi = report.sections.length > 1;
  for (const section of report.sections) {
    if (multi && section.title) lines.push(csvEscape(section.title));
    lines.push(section.columns.map((c) => csvEscape(c.label)).join(","));
    for (const row of section.rows) lines.push(section.columns.map((c) => csvEscape(row[c.key])).join(","));
    if (multi) lines.push("");
  }
  return "﻿" + lines.join("\r\n");
}

/** Standard PDF fonts are WinAnsi-only: swap characters they cannot draw. */
function pdfSafe(v: unknown): string {
  return String(v ?? "")
    .replace(/·/g, "|")
    .replace(/[—–]/g, "-")
    .replace(/→/g, "->")
    .replace(/[“”″]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export function toPdf(reportIn: ReportResult, meta: Meta): Buffer {
  const report: ReportResult = {
    title: pdfSafe(reportIn.title),
    subtitle: pdfSafe(reportIn.subtitle),
    sections: reportIn.sections.map((s) => ({
      title: s.title ? pdfSafe(s.title) : undefined,
      columns: s.columns.map((c) => ({ ...c, label: pdfSafe(c.label) })),
      rows: s.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? null : pdfSafe(v)]))),
    })),
  };
  meta = { organization: pdfSafe(meta.organization), system: pdfSafe(meta.system) };
  const maxCols = Math.max(...report.sections.map((s) => s.columns.length));
  const doc = new jsPDF({ orientation: maxCols > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(report.title, 32, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${meta.organization} · ${meta.system}`, 32, 42);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8.5);
  const sub = doc.splitTextToSize(report.subtitle, pageW - 64);
  doc.text(sub, 32, 74);
  let y = 74 + sub.length * 11 + 6;

  const fontSize = maxCols > 14 ? 6 : maxCols > 9 ? 7 : 8;
  for (const section of report.sections) {
    if (section.title) {
      if (y > pageH - 80) {
        doc.addPage();
        y = 40;
      }
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(section.title, 32, y + 8);
      y += 16;
    }
    autoTable(doc, {
      startY: y,
      head: [section.columns.map((c) => c.label)],
      body: section.rows.length ? section.rows.map((r) => section.columns.map((c) => (r[c.key] ?? "") as string)) : [[{ content: "No records", colSpan: section.columns.length, styles: { halign: "center", textColor: [148, 163, 184] } }]],
      margin: { left: 32, right: 32 },
      styles: { fontSize, cellPadding: 3, overflow: "linebreak", lineColor: [226, 232, 240], lineWidth: 0.4 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 22;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pages}`, pageW - 32, pageH - 16, { align: "right" });
    doc.text(meta.system, 32, pageH - 16);
  }
  return Buffer.from(doc.output("arraybuffer"));
}
