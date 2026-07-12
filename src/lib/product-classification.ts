// Classificação inteligente de produtos (smartphone / tablet / smartwatch / acessorio / outro).
// Regras (ordem de prioridade):
//  1. Campo explícito de tipo (kind/type/product_type/tipo em metadata ou no produto).
//  2. Categoria cadastrada (p.ex. "Smartphone", "Celular", "Tablet", "Smartwatch", "Acessório").
//  3. Análise do nome do produto por palavras-chave.
// has_imei entra apenas como CONFIRMAÇÃO adicional, nunca como único critério.

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

const norm = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// ── Prioridade 1: campos de tipo explícitos ──
const TYPE_MAP: Record<string, ProductClass> = {
  smartphone: "smartphone",
  celular: "smartphone",
  telefone: "smartphone",
  phone: "smartphone",
  iphone: "smartphone",
  android: "smartphone",
  aparelho: "smartphone",
  tablet: "tablet",
  ipad: "tablet",
  smartwatch: "smartwatch",
  watch: "smartwatch",
  relogio: "smartwatch",
  acessorio: "acessorio",
  acessorios: "acessorio",
  accessory: "acessorio",
};

// ── Prioridade 2: categorias que representam dispositivos ──
const DEVICE_CATEGORY_KEYWORDS = [
  "smartphone", "celular", "iphone", "android", "aparelho", "telefone",
  "tablet", "ipad",
  "smartwatch", "watch", "relogio",
];

const ACCESSORY_CATEGORY_KEYWORDS = [
  "acessorio", "acessorios", "capa", "case", "pelicula", "fone", "carregador",
  "cabo", "adaptador", "fonte", "power bank", "suporte", "airpods", "magsafe",
];

// ── Prioridade 3: palavras-chave no nome ──
const SMARTPHONE_NAME_KEYWORDS = [
  "iphone",
  "samsung galaxy",
  "galaxy s", "galaxy a", "galaxy m", "galaxy note", "galaxy z",
  "redmi", "xiaomi", "poco",
  "motorola", "moto g", "moto e", "moto edge",
  "asus zenfone", "zenfone",
  "huawei",
  "nokia",
  "realme",
  "oneplus",
  "infinix",
  "tecno",
];

const TABLET_NAME_KEYWORDS = ["ipad", "galaxy tab", "tablet", "mi pad"];

const SMARTWATCH_NAME_KEYWORDS = [
  "apple watch", "galaxy watch", "smartwatch", "mi band", "mi watch", "amazfit",
];

const ACCESSORY_NAME_KEYWORDS = [
  "cabo", "carregador", "pelicula", "capa", "capinha", "case",
  "fone", "airpods", "adaptador", "fonte", "power bank", "powerbank",
  "suporte", "magsafe", "protetor", "brinde", "pop socket", "popsocket",
];

function containsAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) if (haystack.includes(n)) return true;
  return false;
}

function classifyFromString(text: string): ProductClass | null {
  if (!text) return null;
  // Ordem importa: acessórios primeiro é ruim (ex.: "capa iphone" seria classificada errado).
  // Smartphones/tablets/watches primeiro, depois acessórios.
  if (containsAny(text, TABLET_NAME_KEYWORDS)) return "tablet";
  if (containsAny(text, SMARTWATCH_NAME_KEYWORDS)) return "smartwatch";
  if (containsAny(text, SMARTPHONE_NAME_KEYWORDS)) return "smartphone";
  if (containsAny(text, ACCESSORY_NAME_KEYWORDS)) return "acessorio";
  return null;
}

export function classifyProduct(product: ClassifiableProduct | null | undefined): ProductClass {
  if (!product) return "outro";
  const md = (product.metadata && typeof product.metadata === "object" ? product.metadata : {}) as Record<string, any>;

  // ── 1. Tipo explícito ──
  const typeCandidates = [
    (product as any).kind,
    (product as any).type,
    (product as any).product_type,
    (product as any).product_kind,
    (product as any).tipo,
    md.kind, md.type, md.product_type, md.tipo, md.categoria_interna,
  ];
  for (const t of typeCandidates) {
    const key = norm(t);
    if (key && TYPE_MAP[key]) return TYPE_MAP[key];
  }

  // ── 2. Categoria ──
  const cat = norm(product.category);
  if (cat) {
    if (TYPE_MAP[cat]) return TYPE_MAP[cat];
    if (containsAny(cat, ["tablet", "ipad"])) return "tablet";
    if (containsAny(cat, ["smartwatch", "watch", "relogio"])) return "smartwatch";
    if (containsAny(cat, DEVICE_CATEGORY_KEYWORDS)) return "smartphone";
    if (containsAny(cat, ACCESSORY_CATEGORY_KEYWORDS)) return "acessorio";
  }

  // ── 3. Nome / marca / modelo ──
  const text = norm([product.name, product.brand, product.model].filter(Boolean).join(" "));
  const fromName = classifyFromString(text);
  if (fromName) return fromName;

  // ── Confirmação adicional: has_imei apoia smartphone quando nada acima resolveu ──
  if (product.has_imei === true) return "smartphone";

  return "outro";
}

export function isDeviceClass(c: ProductClass): boolean {
  return c === "smartphone" || c === "tablet" || c === "smartwatch";
}
