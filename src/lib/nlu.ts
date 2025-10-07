// src/lib/nlu.ts
export type Intent = "search" | "add_to_cart";

export type ParsedQuery = {
  intent: Intent;
  queryText: string;
  productType?: string;
  color?: string;
  size?: string;
  priceMax?: number;
  priceMin?: number;
  quantity?: number;
  raw?: string; // utile pour debug
};

const COLOR_ALIASES: Record<string, string[]> = {
  bleu: ["bleu", "bleue", "marine", "bleu marine"],
  rouge: ["rouge"],
  blanc: ["blanc", "blanche"],
  noir: ["noir", "noire"],
  beige: ["beige", "sable", "camel"],
  vert: ["vert", "verte"],
  gris: ["gris", "grise"],
  rose: ["rose"],
  jaune: ["jaune"],
  marron: ["marron", "brun", "brune"]
};

const TYPE_ALIASES: Record<string, string[]> = {
  chemise: ["chemise", "chemises"],
  "tee-shirt": ["t-shirt", "tee-shirt", "tee shirt", "tshirt", "t shirts", "t-shirts"],
  robe: ["robe", "robes"],
  veste: ["veste", "vestes", "blazer"],
  pantalon: ["pantalon", "pantalons", "chino"],
  baskets: ["baskets", "basket", "sneakers", "tennis", "chaussures"]
};

const SIZES = ["XS","S","M","L","XL","XXL","38","39","40","41","42","43","44","45","46"];

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function matchFromAliases(text: string, aliases: Record<string, string[]>) {
  const t = norm(text);
  for (const canonical of Object.keys(aliases)) {
    for (const variant of aliases[canonical]) {
      if (t.includes(norm(variant))) return canonical;
    }
  }
  return undefined;
}

function detectIntent(text: string): Intent {
  const t = norm(text);
  // verbes d'ajout
  const addWords = ["ajoute", "ajouter", "mets", "met", "mettre", "met au panier", "mettre au panier", "ajout", "panier"];
  if (addWords.some(w => t.includes(norm(w)))) {
    return "add_to_cart";
  }
  return "search";
}

export function parseUserUtterance(utterance: string): ParsedQuery {
  const raw = utterance || "";
  const text = norm(raw);

  const intent = detectIntent(text);

  // prix : "moins de 60", "max 80", "<= 50", "jusqu'à 120"
  let priceMax: number | undefined;
  const maxMatch = text.match(/(?:moins de|max(?:imum)?|<=?|inferieur a|jusqua)\s*(\d{2,4})/);
  if (maxMatch) priceMax = parseInt(maxMatch[1], 10);

  // prix : "entre 50 et 80"
  let priceMin: number | undefined;
  const rangeMatch = text.match(/(?:entre)\s*(\d{2,4})\s*(?:et|a)\s*(\d{2,4})/);
  if (rangeMatch) {
    priceMin = parseInt(rangeMatch[1], 10);
    priceMax = parseInt(rangeMatch[2], 10);
  }

  // prix : "autour de 60"
  const aroundMatch = text.match(/(?:autour de|vers|environ)\s*(\d{2,4})/);
  if (aroundMatch && !priceMax) {
    const base = parseInt(aroundMatch[1], 10);
    priceMin = Math.max(0, base - 10);
    priceMax = base + 10;
  }

  // quantité simple : "2", "deux" (on gère juste 1-5 pour MVP)
  let quantity: number | undefined;
  const numMap: Record<string, number> = { "un":1, "une":1, "deux":2, "trois":3, "quatre":4, "cinq":5 };
  const numWord = Object.keys(numMap).find(w => new RegExp(`\\b${w}\\b`).test(text));
  if (numWord) quantity = numMap[numWord];
  const numDigit = text.match(/\b([1-9])\b/);
  if (!quantity && numDigit) quantity = parseInt(numDigit[1], 10);

  // couleur / type
  const color = matchFromAliases(text, COLOR_ALIASES);
  const productType = matchFromAliases(text, TYPE_ALIASES);

  // taille
  let size: string | undefined;
  for (const s of SIZES) {
    const re = new RegExp(`\\b${norm(s)}\\b`);
    if (re.test(text)) { size = s; break; }
  }

  return { intent, queryText: text, productType, color, size, priceMax, priceMin, quantity, raw };
}

export function toSpokenSummary(p: ParsedQuery) {
  const parts: string[] = [];
  if (p.productType) parts.push(p.productType);
  if (p.color) parts.push(p.color);
  if (p.size) parts.push(`taille ${p.size}`);
  if (p.priceMin && p.priceMax) parts.push(`entre ${p.priceMin} et ${p.priceMax} euros`);
  else if (p.priceMax) parts.push(`à moins de ${p.priceMax} euros`);

  if (p.intent === "add_to_cart") {
    if (parts.length === 0) return "D'accord, j'ajoute l'article correspondant au panier si je le trouve.";
    return `D'accord, j'ajoute ${parts.join(", ")} au panier.`;
  }

  if (parts.length === 0) return "Très bien, je regarde ce que je trouve.";
  return `D'accord, je cherche ${parts.join(", ")}.`;
}
