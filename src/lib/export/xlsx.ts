// XLSX writer via SheetJS.
import * as XLSX from "xlsx";

export function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: any[],
  columns?: string[],
  readme?: Record<string, any>,
) {
  const wb = XLSX.utils.book_new();
  const headers = columns && columns.length ? columns : rows.length ? Object.keys(rows[0]) : [];
  // Normalize objects to JSON strings so cells stay legíveis.
  const flat = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const h of headers) {
      const v = r[h];
      out[h] = v && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(flat, { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, safeSheet(sheetName));

  if (readme) {
    const readmeRows = Object.entries(readme).map(([k, v]) => ({
      campo: k,
      valor: typeof v === "object" ? JSON.stringify(v) : String(v),
    }));
    const rws = XLSX.utils.json_to_sheet(readmeRows);
    XLSX.utils.book_append_sheet(wb, rws, "README");
  }

  XLSX.writeFile(wb, filename);
}

function safeSheet(name: string): string {
  return name.replace(/[\\/?*[\]]/g, "_").slice(0, 31);
}
