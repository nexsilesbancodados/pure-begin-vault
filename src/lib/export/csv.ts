// CSV com BOM UTF-8 e separador ";" (Excel BR abre direto).
// Preserva TODAS as colunas, sem renomear. Valores objeto viram JSON.
export function rowsToCsv(rows: any[], columns?: string[]): string {
  if (!rows.length) return "\uFEFF";
  const headers = columns && columns.length ? columns : Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(";"));
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, rows: any[], columns?: string[]) {
  const blob = new Blob([rowsToCsv(rows, columns)], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(filename, blob);
  return blob.size;
}

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
