/**
 * Produces a stable numeric code for a product.
 * - If the SKU is purely numeric, returns its digits (trimmed to 7).
 * - Otherwise derives a deterministic 7-digit number from the product id/sku.
 */
export function toProductCode(input: {
  id?: string | number | null;
  sku?: string | null;
} | string | number | null | undefined): string {
  if (input == null) return "0000000";
  const obj = typeof input === "object" ? input : { id: input, sku: undefined };
  const sku = obj.sku ? String(obj.sku).trim() : "";
  const id = obj.id != null ? String(obj.id) : "";

  // If sku is numeric, use it directly.
  if (sku && /^\d+$/.test(sku)) {
    return sku.length > 7 ? sku.slice(-7) : sku.padStart(7, "0");
  }

  const seed = sku || id || "0";
  // FNV-1a 32-bit hash → 7-digit numeric code.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  const num = hash % 10_000_000;
  return String(num).padStart(7, "0");
}
