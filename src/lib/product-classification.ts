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

export const CLASS_ORDER: ProductClass[] = ["smartphone", "tablet", "smartwatch", "acessorio", "outro"];
