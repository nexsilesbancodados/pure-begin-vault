import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Printer } from "lucide-react";
import { Export, ColumnDef } from "@/lib/exportUniversal";

interface Props<T> {
  filename: string;
  rows: T[];
  cols: ColumnDef<T>[];
  variant?: "outline" | "ghost";
}

export function ExportMenu<T>({ filename, rows, cols, variant = "outline" }: Props<T>) {
  const [open, setOpen] = useState(false);
  const opts = [
    { id: "csv", label: "CSV (texto)", icon: FileText, fn: () => Export.csv(filename, rows, cols) },
    {
      id: "excel",
      label: "Excel (.xls)",
      icon: FileSpreadsheet,
      fn: () => Export.excel(filename, rows, cols),
    },
    {
      id: "pdf",
      label: "PDF (imprimir)",
      icon: Printer,
      fn: () => Export.pdf(filename, rows, cols),
    },
    { id: "json", label: "JSON (técnico)", icon: FileJson, fn: () => Export.json(filename, rows) },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`h-9 px-3 rounded-xl border border-border flex items-center gap-2 text-sm font-bold ${
          variant === "ghost" ? "" : "bg-card hover:bg-muted/50"
        }`}
      >
        <Download className="h-4 w-4" />
        Exportar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {opts.map((o) => (
              <button
                key={o.id}
                disabled={rows.length === 0}
                onClick={() => {
                  o.fn();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <o.icon className="h-4 w-4 text-muted-foreground" />
                {o.label}
              </button>
            ))}
            <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              {rows.length} registro{rows.length !== 1 ? "s" : ""}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
