// EMV Pix (BR Code) generator — pure client-side, sem dependência.
// Especificação: BACEN Manual do BR Code.

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-\/]/g, "")
    .slice(0, max)
    .toUpperCase();
}

export interface PixParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number; // BRL
  txId?: string;
  description?: string;
}

export function buildPixPayload(p: PixParams): string {
  const payloadFormat = tlv("00", "01");
  const pointOfInit = tlv("01", "12"); // 12 = QR dinâmico (com valor) ou 11 = estático

  // Merchant Account Info — GUI + chave + optional description
  let mai = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", p.pixKey);
  if (p.description) {
    mai += tlv("02", sanitize(p.description, 72));
  }
  const merchantAccountInfo = tlv("26", mai);

  const merchantCategoryCode = tlv("52", "0000");
  const transactionCurrency = tlv("53", "986"); // BRL
  const transactionAmount = p.amount && p.amount > 0 ? tlv("54", p.amount.toFixed(2)) : "";
  const countryCode = tlv("58", "BR");
  const merchantName = tlv("59", sanitize(p.merchantName, 25));
  const merchantCity = tlv("60", sanitize(p.merchantCity, 15));

  const additional = tlv("62", tlv("05", sanitize(p.txId || "***", 25)));

  const partial =
    payloadFormat +
    pointOfInit +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantName +
    merchantCity +
    additional +
    "6304";

  const crc = crc16(partial);
  return partial + crc;
}

// QR code via API pública (sem precisar lib). Cache local não necessário pois Pix muda por txId.
export function pixQrUrl(payload: string, size = 280): string {
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10`;
}
