import { toProductCode } from "./product-code";

const TIPO_BY_CATEGORY: Record<string, string> = {
  aparelho: "Celular",
  celular: "Celular",
  smartphone: "Celular",
  iphone: "Celular",
  acessorio: "Acessório",
  acessorios: "Acessório",
  capa: "Acessório",
  fone: "Acessório",
  carregador: "Acessório",
};

function pick(meta: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const v = meta?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * Builds a rich product description for receipts, matching the format:
 *   Celular - iPhone 11 Pro Max - IMEI: 35 391510 181457 4 - SEMINOVO - 64GB - BRANCO - Id: 7579877 - Saúde bateria: 81 - APPLE
 */
export function buildReceiptItemDescription(item: any, product?: any): string {
  const meta: Record<string, any> = {
    ...(product?.metadata && typeof product.metadata === "object" ? product.metadata : {}),
  };

  const category = String(product?.category || meta.tipo || "").toLowerCase();
  const tipo = TIPO_BY_CATEGORY[category] || (meta.tipo ? String(meta.tipo) : "");

  const name = item?.product_name || product?.name || "";
  const imei = item?.imei || pick(meta, "imei", "imei1", "imei_1");
  const condition = pick(meta, "condition", "estado", "status_produto");
  const capacity = pick(meta, "storage", "gigas", "capacity", "gb");
  const color = pick(meta, "color", "cor");
  const battery = pick(meta, "battery_health", "bateria", "battery");
  const brand = product?.brand || pick(meta, "brand", "marca", "manufacturer");
  const code = toProductCode({ id: item?.product_id ?? product?.id, sku: item?.sku ?? product?.sku });

  const parts = [
    tipo,
    name,
    imei ? `IMEI: ${imei}` : "",
    condition ? condition.toUpperCase() : "",
    capacity ? (/^\d+$/.test(capacity) ? `${capacity}GB` : capacity.toUpperCase()) : "",
    color ? color.toUpperCase() : "",
    `Id: ${code}`,
    battery ? `Saúde bateria: ${String(battery).replace(/%/g, "").trim()}` : "",
    brand ? brand.toUpperCase() : "",
  ].filter(Boolean);

  return parts.join(" - ");
}
