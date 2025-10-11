"use client";

import * as React from "react";
import Fuse from "fuse.js";

// ---------- Types ----------
type Variant = {
  id: string;
  title: string;
  price: number;
  currency: string;
  available?: boolean;
};

type Product = {
  id: string;
  title: string;
  description: string;
  image?: string;
  tags: string[];
  variants: Variant[];
};

type CartItem = {
  productId: string;
  variantId: string;
  qty: number;
};

type Props = {
  welcomeMessage?: string;
  products?: Product[];          // catalogue externe (sinon on charge le local)
  brandColor?: string;           // couleur du bandeau (ex: "#ff6600")
  ttsEnabled?: boolean;          // activer le retour vocal (via ?tts=1)
};

// ---------- Utils ----------
function formatPrice(p: number, c: string) {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: c }).format(p); }
  catch { return `${p.toFixed(2)} ${c}`; }
}
function includesCI(hay: string, needle: string) { return hay.toLowerCase().includes(needle.toLowerCase()); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function speak(tts: boolean, text: string) {
  if (!tts) return;
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  window.speechSynthesis.speak(u);
}

// ---------- Fallback Image ----------
function FallbackImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [errored, setErrored] = React.useState(false);
  const { alt, loading, ...rest } = props;
  const placeholder = "https://via.placeholder.com/72x72?text=%20";
  return (
    <img
      alt={alt || ""}
      loading={loading ?? "lazy"}
      onError={() => setErrored(true)}
      {...rest}
      src={errored || !props.src ? placeholder : (props.src as string)}
    />
  );
}

// ---------- Catégories / couleurs / stopwords ----------
const STOPWORDS = new Set([
  "ajoute","ajouter","mets","mettre","met","dans","au","aux","à","le","la","les","un","une","des","du","de","d",
  "panier","stp","svp","s'il","te","plaît","en","et","sur","pour","me","moi","lequel","laquelle"
]);
const CATEGORY_SYNONYMS: Record<string,string[]> = {
  baskets: ["basket","baskets","sneaker","sneakers","chaussure","chaussures"],
  chemise: ["chemise","chemises","shirt"],
  robe: ["robe","robes","dress"],
  pantalon: ["pantalon","pantalons","chino","jean","jeans"]
};
const COLORS = ["noir","noire","noires","bleu","bleue","bleues","blanc","blanche","blanches","rouge","rouges","beige","vert","verte"];

// ---------- Composant principal ----------
export default function VoiceAssistant({ welcomeMessage, products, brandColor, ttsEnabled = false }: Props) {
  // Navigation
  const [view, setView] = React.useState<"home" | "results">("home");

  // États UI
  const [query, setQuery] = React.useState("");
  const [transcript, setTranscript] = React.useState<string | null>(
    welcomeMessage || "Bienvenue 👋 ! Dis-moi ce que tu cherches 😊"
  );
  const [listening, setListening] = React.useState(false);
  const [results, setResults] = React.useState<Product[]>([]);
  const [suggestions, setSuggestions] = React.useState<Product[]>([]);
  const [showAllSuggestions, setShowAllSuggestions] = React.useState(false);
  const [showCart, setShowCart] = React.useState(false);

  // Panier
  const [cart, setCart] = React.useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("va_cart");
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch { return []; }
  });

  // Catalogue local si rien n'est passé
  const [localProducts, setLocalProducts] = React.useState<Product[] | null>(null);
  React.useEffect(() => {
    if (products) return;
    const tryUrls = ["/api/catalogue", "/api/catalogue-partner"];
    (async () => {
      for (const u of tryUrls) {
        try {
          const r = await fetch(u, { cache: "no-store" });
          if (!r.ok) continue;
          const data = await r.json();
          const arr = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : null;
          if (arr) { setLocalProducts(arr as Product[]); return; }
        } catch {}
      }
    })();
  }, [products]);

  const allProducts: Product[] = React.useMemo(
    () => products ?? localProducts ?? [],
    [products, localProducts]
  );

  // Sauvegarde panier
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("va_cart", JSON.stringify(cart));
    }
  }, [cart]);

  // Tracking simple
  async function track(event: string, payload: any = {}) {
    try {
      await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, payload, ts: Date.now() }),
      });
    } catch {}
  }

  // ---------- Reconnaissance vocale ----------
  const recognitionRef = React.useRef<any | null>(null);
  function ensureRecognition(): boolean {
    if (typeof window === "undefined") return false;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return false;
    if (!recognitionRef.current) {
      recognitionRef.current = new SR();
      recognitionRef.current.lang = "fr-FR";
      recognitionRef.current.interimResults = false;
      recognitionRef.current.continuous = false;
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.onresult = (ev: any) => {
        const t = ev.results?.[0]?.[0]?.transcript || "";
        setQuery(t);
        setTranscript(`🗣️ ${t}`);
        track("speech_result", { t });
      };
      recognitionRef.current.onend = () => setListening(false);
      recognitionRef.current.onerror = () => setListening(false);
    }
    return true;
  }
  function startListening() {
    if (!ensureRecognition()) {
      setTranscript("La reconnaissance vocale n'est pas disponible dans ce navigateur.");
      return;
    }
    setListening(true);
    recognitionRef.current!.start();
    track("speech_start");
  }
  function stopListening() {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    track("speech_stop");
  }

  // ---------- NLU / tokens ----------
  function normalizeSizeToken(tok: string) {
    const t = tok.trim().toLowerCase();
    const known = ["xs","s","m","l","xl","xxl","xxxl"];
    if (known.includes(t)) return t.toUpperCase();
    const num = parseInt(t, 10);
    if (!isNaN(num)) return String(num);
    return null;
  }
  function tokenizeMeaningful(raw: string) {
    return raw
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .filter(w => !STOPWORDS.has(w));
  }
  function guessCategory(tokens: string[]): string | null {
    for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
      if (tokens.some(t => syns.includes(t))) return cat;
    }
    return null;
  }
  function extractIntent(q: string) {
    const raw = q.toLowerCase();
    const isAdd = /(ajoute|mets?|mettre)\s(au|dans)\s(le\s)?panier/.test(raw);
    const isClear = /(vide|vider)\s(le\s)?panier/.test(raw);
    const isCheckout = /(valide(r)?|paye(r)?|paiement|checkout|caisse)/.test(raw);

    const tokens = raw.split(/\s+/).filter(Boolean);
    let size: string | null = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const n = normalizeSizeToken(tokens[i]); if (n) { size = n; break; }
    }
    const color = COLORS.find(c => raw.includes(c)) || null;

    const cleanTokens = tokenizeMeaningful(raw);
    const category = guessCategory(cleanTokens);
    return { isAdd, isClear, isCheckout, size, color, cleanTokens, category, raw };
  }

  // ---------- Fuse index (fuzzy) ----------
  const fuseRef = React.useRef<Fuse<Product> | null>(null);
  React.useEffect(() => {
    if (!allProducts.length) { fuseRef.current = null; return; }
    fuseRef.current = new Fuse(allProducts, {
      keys: ["title", "description", "tags"],
      includeScore: true,
      threshold: 0.4, // tolérance aux fautes (0 = strict, 1 = très permissif)
      ignoreLocation: true,
    });
  }, [allProducts]);

  // ---------- Recherche (fuzzy + rerank) ----------
  function rerankByIntent(list: Product[], color: string | null, category: string | null, extraWords: string[]) {
    return list
      .map(p => {
        const text = (p.title + " " + p.description + " " + p.tags.join(" ")).toLowerCase();
        let score = 0;
        if (category) {
          const syns = CATEGORY_SYNONYMS[category] || [category];
          if (syns.some(s => text.includes(s))) score += 4;
        }
        if (color && text.includes(color)) score += 3;
        for (const w of extraWords) {
          if (COLORS.includes(w) || STOPWORDS.has(w)) continue;
          if (text.includes(w)) score += 1;
        }
        return { p, score };
      })
      .sort((a,b) => b.score - a.score)
      .map(x => x.p);
  }

  function searchProducts(q: string) {
    const { color, cleanTokens, category } = extractIntent(q);
    let list: Product[] = [];

    if (fuseRef.current && q.trim()) {
      const res = fuseRef.current.search(q);
      list = res.map(r => r.item);
      // rerank selon couleur/catégorie/mots
      list = rerankByIntent(list, color, category, cleanTokens);
    } else {
      list = allProducts.slice();
    }

    const strict = list.slice(0, 12);
    const sugg = allProducts.filter(p => !strict.includes(p)).slice(0, 12);

    setResults(strict);
    setSuggestions(sugg);
    setShowAllSuggestions(false);
    setView("results");
    track("search", { q, results: strict.length });
  }

  // ---------- Panier : ajout robuste (fuzzy + scoring) ----------
  function addToCartByText(q: string) {
    const { size, color, cleanTokens, category } = extractIntent(q);

    let candidates: Product[] = allProducts.slice();
    if (fuseRef.current && q.trim()) {
      candidates = fuseRef.current.search(q).map(r => r.item);
    }
    const scored = rerankByIntent(candidates, color, category, cleanTokens);
    const target = scored[0] ?? allProducts[0];
    if (!target) {
      setTranscript("Je n'ai pas trouvé de produit à ajouter.");
      speak(ttsEnabled, "Je n'ai pas trouvé de produit à ajouter.");
      return;
    }

    let chosen: Variant | undefined;
    if (size) {
      chosen = target.variants.find(
        (v) =>
          v.title.toLowerCase() === size.toLowerCase() ||
          v.title.toLowerCase() === `taille ${size.toLowerCase()}`
      );
    }
    if (!chosen) chosen = target.variants.find(v => v.available) ?? target.variants[0];
    if (!chosen) {
      setTranscript("Aucune variante disponible pour ce produit.");
      speak(ttsEnabled, "Aucune variante disponible pour ce produit.");
      return;
    }

    setCart(prev => {
      const found = prev.find(i => i.productId === target.id && i.variantId === chosen!.id);
      if (found) {
        return prev.map(i =>
          i.productId === target.id && i.variantId === chosen!.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { productId: target.id, variantId: chosen!.id, qty: 1 }];
    });

    const msg = `Ajouté au panier: ${target.title}, ${chosen.title}`;
    setTranscript("✅ " + msg);
    speak(ttsEnabled, msg);
    setView("results");
    setShowCart(true);
    track("add_to_cart", { q, productId: target.id, variantId: chosen.id });
  }

  function clearCart() {
    setCart([]);
    setTranscript("🧺 Panier vidé.");
    speak(ttsEnabled, "Panier vidé.");
    track("clear_cart");
  }

  // ---------- Navigation ----------
  function goHome() {
    setResults([]);
    setSuggestions([]);
    setQuery("");
    setView("home");
    setTranscript(welcomeMessage || "Bienvenue 👋 ! Dis-moi ce que tu cherches 😊");
  }

  function handleSearch() {
    const q = (query || "").trim();
    if (!q) {
      setTranscript("Je n'ai rien entendu. Clique sur 🎙️ et essaie encore.");
      speak(ttsEnabled, "Je n'ai rien entendu.");
      return;
    }
    const { isAdd, isClear, isCheckout } = extractIntent(q);
    if (isClear) { clearCart(); return; }
    if (isCheckout) { setTranscript("🧾 (Démo) Ouverture du panier…"); setShowCart(true); setView("results"); track("checkout_attempt"); return; }
    if (isAdd) { addToCartByText(q); return; }
    setTranscript(`D'accord, je cherche ${q}.`);
    searchProducts(q);
  }

  const cartCount = React.useMemo(() => cart.reduce((n, it) => n + it.qty, 0), [cart]);

  // Utils d’affichage panier
  const productById = React.useCallback((id: string) => allProducts.find(p => p.id === id), [allProducts]);
  const variantById = (p: Product | undefined, id: string) => p?.variants.find(v => v.id === id);
  const cartTotal = React.useMemo(() => {
    let sum = 0;
    for (const it of cart) {
      const p = productById(it.productId);
      const v = variantById(p, it.variantId);
      if (p && v) sum += v.price * it.qty;
    }
    return sum;
  }, [cart, productById]);

  // ---------- Rendu ----------
  const headerColor = brandColor || "#0ea5e9";

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 999999,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      {/* Micro flottant */}
      <button
        onClick={() => (listening ? stopListening() : startListening())}
        title="Parler"
        aria-label="Parler"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 48,
          height: 48,
          borderRadius: 999,
          border: "none",
          background: listening ? "#f43f5e" : headerColor,
          color: "#fff",
          boxShadow: "0 10px 24px rgba(0,0,0,.2)",
          cursor: "pointer",
        }}
      >
        🎙️
      </button>

      {/* Fenêtre principale */}
      <div
        style={{
          width: 380,
          maxWidth: "90vw",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 40px rgba(0,0,0,.18)",
          display: "flex",
          flexDirection: "column",
          maxHeight: 640,
        }}
      >
        {/* Barre sticky */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: headerColor,
            color: "#fff",
            padding: "10px 12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          <span>Voice Assistant</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowCart(true)}
              title="Voir le panier"
              aria-label="Voir le panier"
              style={{
                background: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              🧺 Panier ({cartCount})
            </button>
            {view === "results" && (
              <button
                onClick={goHome}
                title="Retour à l’accueil"
                aria-label="Retour à l’accueil"
                style={{
                  background: "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                ⬅️ Accueil
              </button>
            )}
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ overflowY: "auto", padding: 12 }}>
          {/* Messages */}
          <div style={{ minHeight: 24, marginBottom: 8 }} aria-live="polite">
            {view === "home" && (
              <div style={{ fontSize: 14 }}>
                {welcomeMessage || "Bienvenue 👋 ! Dis-moi ce que tu cherches 😊"}
              </div>
            )}
            {view === "results" && transcript ? (
              <div style={{ fontSize: 14 }}>{transcript}</div>
            ) : null}
          </div>

          {/* Carte assistant */}
          <div
            style={{
              display: "grid",
              gap: 10,
              border: "1px solid #f1f5f9",
              background: "#fafafa",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                🎙️
              </div>
              <div style={{ fontWeight: 700 }}>Assistant vocal</div>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Par ex. 'chemise bleue M' ou 'mets au panier les baskets noires 42'"
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
                fontSize: 14,
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleSearch}
                style={{
                  flex: 1,
                  background: headerColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Rechercher / Exécuter
              </button>
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "#f1f5f9",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                Effacer
              </button>
              <button
                onClick={() => setShowCart(true)}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Panier ({cartCount})
              </button>
            </div>

            {!listening ? (
              <div style={{ fontSize: 12, color: "#475569" }}>
                Clique sur 🎙️ pour parler. Tu peux aussi taper dans le champ.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#b91c1c" }}>
                Écoute en cours… parle maintenant (clique 🎙️ pour stopper)
              </div>
            )}
          </div>

          {/* Résultats */}
          {results.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Résultats</div>
              <div style={{ display: "grid", gap: 12 }}>
                {results.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <FallbackImage
                      src={p.image}
                      alt={p.title}
                      width={72}
                      height={72}
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{p.description}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {p.variants.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              fontSize: 12,
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              padding: "4px 8px",
                            }}
                          >
                            {v.title} · {formatPrice(v.price, v.currency)}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          onClick={() => {
                            const firstAvailable = p.variants.find((v) => v.available) ?? p.variants[0];
                            if (!firstAvailable) return;
                            setCart((prev) => [
                              ...prev,
                              { productId: p.id, variantId: firstAvailable.id, qty: 1 },
                            ]);
                            const msg = `Ajouté: ${p.title} — ${firstAvailable.title}`;
                            setTranscript("✅ " + msg);
                            speak(ttsEnabled, msg);
                            setShowCart(true);
                            track("add_to_cart_button", { productId: p.id, variantId: firstAvailable.id });
                          }}
                          style={{
                            background: headerColor,
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Ajouter au panier
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div
              style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>Tu pourrais aimer aussi</div>
                <button
                  onClick={() => setShowAllSuggestions((s) => !s)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {showAllSuggestions ? "Réduire" : "Afficher plus"}
                </button>
              </div>
              <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                {(showAllSuggestions ? suggestions : suggestions.slice(0, 3)).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <FallbackImage
                      src={p.image}
                      alt={p.title}
                      width={72}
                      height={72}
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{p.description}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {p.variants.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              fontSize: 12,
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              padding: "4px 8px",
                            }}
                          >
                            {v.title} · {formatPrice(v.price, v.currency)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------- PANNEAU PANIER ---------- */}
        {showCart && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              borderRadius: 14,
            }}
            onClick={() => setShowCart(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 360,
                background: "#fff",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                boxShadow: "0 -10px 30px rgba(0,0,0,.3)",
                padding: 12,
                maxHeight: 520,
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>🧺 Panier</div>
                <button
                  onClick={() => setShowCart(false)}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Fermer
                </button>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {cart.length === 0 && <div style={{ color: "#64748b" }}>Votre panier est vide.</div>}
                {cart.map((it, idx) => {
                  const p = productById(it.productId);
                  const v = variantById(p, it.variantId);
                  if (!p || !v) return null;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 8,
                      }}
                    >
                      <FallbackImage
                        src={p.image}
                        alt={p.title}
                        width={56}
                        height={56}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Variante : {v.title} — {formatPrice(v.price, v.currency)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <button
                            onClick={() =>
                              setCart(prev =>
                                prev
                                  .map(ci =>
                                    ci.productId === it.productId && ci.variantId === it.variantId
                                      ? { ...ci, qty: clamp(ci.qty - 1, 0, 999) }
                                      : ci
                                  )
                                  .filter(ci => ci.qty > 0)
                              )
                            }
                            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 6, padding: "2px 8px" }}
                          >
                            −
                          </button>
                          <div style={{ minWidth: 24, textAlign: "center" }}>{it.qty}</div>
                          <button
                            onClick={() =>
                              setCart(prev =>
                                prev.map(ci =>
                                  ci.productId === it.productId && ci.variantId === it.variantId
                                    ? { ...ci, qty: clamp(ci.qty + 1, 1, 999) }
                                    : ci
                                )
                              )
                            }
                            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 6, padding: "2px 8px" }}
                          >
                            +
                          </button>
                          <button
                            onClick={() =>
                              setCart(prev =>
                                prev.filter(ci => !(ci.productId === it.productId && ci.variantId === it.variantId))
                              )
                            }
                            style={{
                              border: "1px solid #fecaca",
                              background: "#fee2e2",
                              color: "#991b1b",
                              borderRadius: 6,
                              padding: "2px 8px",
                              marginLeft: 8,
                            }}
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {formatPrice(v.price * it.qty, v.currency)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
                <div>Total</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {allProducts[0]?.variants[0]?.currency
                    ? formatPrice(cartTotal, allProducts[0].variants[0].currency)
                    : `${cartTotal.toFixed(2)} €`}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setShowCart(false)}
                  style={{ flex: 1, background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px" }}
                >
                  Continuer mes achats
                </button>
                <button
                  onClick={() => setTranscript("🧾 (Démo) Redirection vers le checkout…")}
                  style={{ flex: 1, background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px" }}
                >
                  Passer au paiement
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ---------- FIN PANNEAU PANIER ---------- */}
      </div>
    </div>
  );
}
