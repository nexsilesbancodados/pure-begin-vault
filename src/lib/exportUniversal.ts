// Export universal: CSV, Excel (XLSX-compatible HTML), PDF (via window.print) e JSON.
// Sem dependências externas — usa Blob + DOM nativo.

export type ColumnDef<T> = {
  key: keyof T | string;
  label: string;
  format?: (v: any, row: T) => string;
};

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getValue<T>(row: T, col: ColumnDef<T>): string {
  const raw = (row as any)[col.key];
  if (col.format) return col.format(raw, row);
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function exportCsv<T>(filename: string, rows: T[], cols: ColumnDef<T>[]) {
  const escape = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [
    cols.map((c) => escape(c.label)).join(","),
    ...rows.map((r) => cols.map((c) => escape(getValue(r, c))).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(`${filename}.csv`, blob);
}

// XLSX-compatível: tabela HTML com MIME do Excel. O Excel abre direto e salva como .xlsx
export function exportExcel<T>(filename: string, rows: T[], cols: ColumnDef<T>[]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(filename)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1">
<thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(getValue(r, c))}</td>`).join("")}</tr>`).join("")}</tbody>
</table></body></html>`;
  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" });
  triggerDownload(`${filename}.xls`, blob);
}

export function exportJson<T>(filename: string, rows: T[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  triggerDownload(`${filename}.json`, blob);
}

export function exportPdf<T>(title: string, rows: T[], cols: ColumnDef<T>[]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html><html><head><title>${esc(title)}</title>
<style>
  body{font-family:system-ui,Arial;padding:24px;font-size:12px;color:#0f172a}
  h1{font-size:18px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
  th{background:#f1f5f9;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  tr:nth-child(even) td{background:#f8fafc}
  @media print{button{display:none}}
</style></head>
<body>
<h1>${esc(title)}</h1>
<p style="font-size:10px;color:#64748b;margin-bottom:12px">Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} registros</p>
<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(getValue(r, c))}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export const Export = {
  csv: exportCsv,
  excel: exportExcel,
  json: exportJson,
  pdf: exportPdf,
};
