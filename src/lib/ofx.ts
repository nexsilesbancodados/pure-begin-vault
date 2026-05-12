// Parser OFX simples — extrai transações <STMTTRN> e devolve lista normalizada.
// Aceita OFX 1.x (SGML) e 2.x (XML). Não valida assinaturas.

export interface OfxTx {
  type: "credit" | "debit";
  amount: number;
  date: string; // ISO
  fitid: string;
  memo: string;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseOfxDate(d: string): string {
  // YYYYMMDDHHMMSS[.xxx][TZ] ou YYYYMMDD
  const clean = d.replace(/[^0-9]/g, "").slice(0, 14);
  if (clean.length < 8) return new Date().toISOString();
  const yyyy = clean.slice(0, 4);
  const mm = clean.slice(4, 6);
  const dd = clean.slice(6, 8);
  const hh = clean.slice(8, 10) || "00";
  const mi = clean.slice(10, 12) || "00";
  const ss = clean.slice(12, 14) || "00";
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

export function parseOfx(content: string): OfxTx[] {
  const txs: OfxTx[] = [];
  // Pega cada bloco <STMTTRN>...</STMTTRN>
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const b of blocks) {
    const get = (tag: string): string => {
      const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
      const m = b.match(re);
      return m ? unescapeXml(m[1].trim()) : "";
    };
    const trnType = get("TRNTYPE").toUpperCase();
    const amtRaw = get("TRNAMT");
    const dtposted = get("DTPOSTED");
    const fitid = get("FITID");
    const memo = get("MEMO") || get("NAME") || "";

    const amt = parseFloat(amtRaw.replace(",", "."));
    if (isNaN(amt) || amt === 0) continue;

    txs.push({
      type: amt < 0 || trnType === "DEBIT" ? "debit" : "credit",
      amount: Math.abs(amt),
      date: parseOfxDate(dtposted),
      fitid: fitid || `${dtposted}_${amtRaw}`,
      memo,
    });
  }
  return txs;
}
