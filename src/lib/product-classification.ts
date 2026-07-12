// Classificação inteligente de produtos (smartphone / tablet / smartwatch / acessorio / outro).
// ORDEM OBRIGATÓRIA:
//   1. ACESSÓRIO (palavras de acessório vêm ANTES de qualquer marca/modelo).
//      Ex.: "Cabo USB Lightning iPhone" ⇒ acessorio (não smartphone).
//   2. Tablet (iPad, Galaxy Tab, Tablet).
//   3. Smartwatch (Apple Watch, Galaxy Watch, Amazfit...).
//   4. Smartphone (iPhone, Galaxy S/A, Redmi, Moto G, Poco...).
//   5. Categoria cadastrada / campo explícito só reforçam quando nada acima acionou.
//   6. has_imei entra apenas como confirmação final.

export type ProductClass = "smartphone" | "tablet" | "smartwatch" | "acessorio" | "outro";

export interface ClassifiableProduct {
  name?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  has_imei?: boolean | null;
  metadata?: any;
  [key: string]: any;
}

const asStr = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

const norm = (s: unknown): string =>
  asStr(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// ── 1. ACESSÓRIOS — checados PRIMEIRO ──
const ACCESSORY_KEYWORDS = [
  "cabo", "cabo usb", "cabo lightning", "cabo tipo c", "cabo tipo-c",
  "carregador", "carregador turbo", "carregador magsafe",
  "fonte",
  "pelicula", "pelicula 3d", "pelicula privacy",
  "capa", "capinha", "case",
  "adaptador",
  "power bank", "powerbank",
  "bateria",
  "fone", "fones",
  "airpods", "airpod",
  "suporte",
  "magsafe",
  "lightning",
  "usb", "usb-c", "tipo c", "tipo-c",
  "brinde", "protetor", "pop socket", "popsocket",
];

// ── 2. Tablets ──
const TABLET_KEYWORDS = ["ipad", "galaxy tab", "tablet", "mi pad"];

// ── 3. Smartwatches ──
const SMARTWATCH_KEYWORDS = [
  "apple watch", "galaxy watch", "smartwatch",
  "mi band", "mi watch", "amazfit", "redmi watch", "watch",
];

// ── 4. Smartphones ──
const SMARTPHONE_KEYWORDS = [
  "iphone",
  "samsung galaxy",
  "galaxy s", "galaxy a", "galaxy m", "galaxy note", "galaxy z",
  "redmi", "xiaomi", "poco",
  "motorola", "moto g", "moto e", "moto edge",
  "asus zenfone", "zenfone",
  "huawei", "nokia", "realme", "oneplus", "infinix", "tecno",
];

// ── Categorias diretas (5º passo — reforço) ──
const CATEGORY_MAP: Record<string, ProductClass> = {
  smartphone: "smartphone", celular: "smartphone", telefone: "smartphone",
  iphone: "smartphone", android: "smartphone", aparelho: "smartphone",
  tablet: "tablet", ipad: "tablet",
  smartwatch: "smartwatch", watch: "smartwatch", relogio: "smartwatch",
  acessorio: "acessorio", acessorios: "acessorio", accessory: "acessorio",
  capa: "acessorio", case: "acessorio", pelicula: "acessorio",
  fone: "acessorio", carregador: "acessorio", cabo: "acessorio",
};

const containsAny = (text: string, needles: string[]): boolean => {
  for (const n of needles) if (text.includes(n)) return true;
  return false;
};

export function classifyProduct(product: ClassifiableProduct | null | undefined): ProductClass {
  if (!product) return "outro";
  const md = (product.metadata && typeof product.metadata === "object" ? product.metadata : {}) as Record<string, any>;

  const text = norm(
    [product.name, product.brand, product.model, product.category].filter(Boolean).join(" "),
  );

  // 1º — ACESSÓRIO (vence tudo, mesmo com "iphone" no nome)
  if (text && containsAny(text, ACCESSORY_KEYWORDS)) return "acessorio";

  // 2º — Tablet
  if (text && containsAny(text, TABLET_KEYWORDS)) return "tablet";

  // 3º — Smartwatch
  if (text && containsAny(text, SMARTWATCH_KEYWORDS)) return "smartwatch";

  // 4º — Smartphone
  if (text && containsAny(text, SMARTPHONE_KEYWORDS)) return "smartphone";

  // 5º — Categoria cadastrada
  const cat = norm(product.category);
  if (cat) {
    if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
    if (containsAny(cat, ["tablet", "ipad"])) return "tablet";
    if (containsAny(cat, ["smartwatch", "watch", "relogio"])) return "smartwatch";
    if (containsAny(cat, ["smartphone", "celular", "aparelho", "telefone"])) return "smartphone";
    if (containsAny(cat, ["acessorio", "capa", "pelicula", "cabo", "carregador", "fone"])) return "acessorio";
  }

  // 6º — Tipo explícito
  const typeCandidates = [
    (product as any).kind, (product as any).type, (product as any).product_type,
    (product as any).tipo, md.kind, md.type, md.tipo, md.categoria_interna,
  ];
  for (const t of typeCandidates) {
    const key = norm(t);
    if (key && CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  }

  // 7º — has_imei apoia smartphone
  if (product.has_imei === true) return "smartphone";

  return "outro";
}

export function isDeviceClass(c: ProductClass): boolean {
  return c === "smartphone" || c === "tablet" || c === "smartwatch";
}

// ─────────────────────────────────────────────────────────────────
// resolveHasImei — REGRA ÚNICA usada em auditoria e CSV.
// Nunca comparar product.has_imei diretamente fora desta função.
// ─────────────────────────────────────────────────────────────────
const nonEmpty = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "boolean") return v === true;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(nonEmpty);
  if (typeof v === "object") return Object.keys(v as any).length > 0;
  return false;
};

export function resolveHasImei(product: any): boolean {
  if (!product) return false;
  const md: any = product.metadata && typeof product.metadata === "object" ? product.metadata : {};
  if (product.has_imei === true) return true;
  if (nonEmpty(product.imei)) return true;
  if (nonEmpty(product.imei1)) return true;
  if (nonEmpty(product.imei2)) return true;
  if (nonEmpty(product.serial_number)) return true;
  if (nonEmpty(md.imei)) return true;
  if (nonEmpty(md.imei_1) || nonEmpty(md.imei1)) return true;
  if (nonEmpty(md.imeis)) return true;
  if (nonEmpty(md.serial_number)) return true;
  if (md.has_imei === true) return true;
  if (Number(md.imei_count ?? 0) > 0) return true;
  return false;
}

// resolveImei — retorna string com o(s) IMEI(s) separados por vírgula, ou "".
// Nunca retorna "sim"/"nao"; apenas os números reais.
export function resolveImei(product: any): string {
  if (!product) return "";
  const md: any = product.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const collected: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(push); return; }
    const s = String(v).trim();
    if (!s) return;
    // Aceita apenas dígitos (IMEI/serial numérico). Ignora "sim"/"nao"/booleanos textuais.
    if (/^[0-9]{6,}$/.test(s.replace(/\s+/g, ""))) collected.push(s.replace(/\s+/g, ""));
    else if (/[0-9]/.test(s) && !/^(sim|nao|não|true|false|yes|no)$/i.test(s)) collected.push(s);
  };
  push(product.imei);
  push(product.imei1);
  push(product.imei2);
  push(md.imei);
  push(md.imei_1);
  push(md.imei1);
  push(md.imei2);
  push(md.imeis);
  // serial_number apenas quando parece IMEI (numérico ≥ 6 dígitos)
  const sn = product.serial_number ?? md.serial_number;
  if (sn && /^[0-9]{6,}$/.test(String(sn).replace(/\s+/g, ""))) collected.push(String(sn).replace(/\s+/g, ""));
  // dedupe preservando ordem
  const seen = new Set<string>();
  const uniq = collected.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
  return uniq.join(",");
}

export const CLASS_ORDER: ProductClass[] = ["smartphone", "tablet", "smartwatch", "acessorio", "outro"];
