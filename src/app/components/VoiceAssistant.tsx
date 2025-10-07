"use client";

import { useEffect, useRef, useState } from "react";
import defaultProducts from "@/data/products.json";
import { parseUserUtterance, toSpokenSummary, ParsedQuery } from "@/lib/nlu";

type Variant = { id: string; title: string; price: number; currency: string; available: boolean };
type Product = { id: string; title: string; description: string; image: string; variants: Variant[]; tags: string[] };

type VoiceAssistantProps = {
  welcomeMessage?: string;
  products?: Product[]; // ← catalogue externe optionnel
};

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

function getRecognizerCtor() {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}
function supportSTT() { return typeof window !== "undefined" && !!getRecognizerCtor(); }
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const fr = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("fr"));
  if (fr) u.voice = fr;
  try { window.speechSynthesis.cancel(); } catch {}
  window.speechSynthesis.speak(u);
}

function norm(s: string) { return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""); }
function includes(hay: string, needle: string) { return norm(hay).includes(norm(needle)); }

// --- recherche
function filterWithFallbacks(all: Product[], parsed: ParsedQuery) {
  const dbg: string[] = [];
  const qText = norm(parsed.queryText || "");
  const wantType = parsed.productType ? norm(parsed.productType) : undefined;
  const wantColor = parsed.color ? norm(parsed.color) : undefined;
  const wantMin = parsed.priceMin ?? undefined;
  const wantMax = parsed.priceMax ?? undefined;

  function match(p: Product, opt: { ignoreType?: boolean; ignoreColor?: boolean; ignorePrice?: boolean; ignoreText?: boolean }) {
    const title = norm(p.title), desc = norm(p.description), tags = p.tags.map(norm).join(" ");
    const textOK = opt.ignoreText || !qText ? true : includes(title + " " + desc + " " + tags, qText);
    const typeOK = opt.ignoreType || !wantType ? true : includes(tags + " " + title, wantType);
    const colorOK = opt.ignoreColor || !wantColor ? true : includes(tags + " " + title, wantColor);
    const priceOK = opt.ignorePrice || (!wantMin && !wantMax) ? true
      : p.variants.some(v => (wantMin ? v.price >= wantMin : true) && (wantMax ? v.price <= wantMax : true));
    return textOK && typeOK && colorOK && priceOK;
  }

  let list = all.filter(p => match(p, {}));                       dbg.push(`Passe 1 (strict) → ${list.length}`);
  if (list.length === 0) { list = all.filter(p => match(p, { ignorePrice: true })); dbg.push(`Passe 2 (sans prix) → ${list.length}`); }
  if (list.length === 0) { list = all.filter(p => match(p, { ignoreColor: true })); dbg.push(`Passe 3 (sans couleur) → ${list.length}`); }
  if (list.length === 0) { list = all.filter(p => match(p, { ignoreType: true }));  dbg.push(`Passe 4 (sans type) → ${list.length}`); }
  if (list.length === 0) { list = all.filter(p => match(p, { ignoreText: true }));  dbg.push(`Passe 5 (ultra large) → ${list.length}`); }

  let suggestions: Product[] = [];
  if (list.length < 3) {
    const targetType = wantType;
    const targetColor = wantColor;
    const maxDelta = 20;
    suggestions = all.filter(p => {
      if (list.find(x => x.id === p.id)) return false;
      const hasType = targetType ? includes(p.tags.join(" ") + " " + p.title, targetType) : false;
      const hasColor = targetColor ? includes(p.tags.join(" ") + " " + p.title, targetColor) : false;
      const priceOK = (wantMax || wantMin) ? p.variants.some(v => {
        const okMax = wantMax ? v.price <= (wantMax + maxDelta) : true;
        const okMin = wantMin ? v.price >= Math.max(0, wantMin - maxDelta) : true;
        return okMax && okMin;
      }) : false;
      return hasType || hasColor || priceOK;
    }).slice(0, 6);
  }

  return { list, debug: dbg, suggestions };
}

// --- panier
type CartLine = { variantId: string; productId: string; title: string; variantTitle: string; price: number; currency: string; qty: number; image: string };
function readCart(): CartLine[] { try { return JSON.parse(typeof window !== "undefined" ? localStorage.getItem("cart") || "[]" : "[]"); } catch { return []; } }
function writeCart(lines: CartLine[]) { if (typeof window !== "undefined") localStorage.setItem("cart", JSON.stringify(lines)); }

// --- scoring ajout
function scoreProduct(p: Product, parsed: ParsedQuery) {
  const tAll = norm(`${p.title} ${p.description} ${p.tags.join(" ")}`);
  let score = 0;
  if (parsed.productType && includes(tAll, parsed.productType)) score += 3;
  if (parsed.color && includes(tAll, parsed.color)) score += 3;
  if (parsed.size) {
    const v = p.variants.find(v => includes(v.title, parsed.size as string));
    if (v && v.available) score += 3;
    else if (v) score += 1;
  }
  if (parsed.productType && !includes(tAll, parsed.productType)) score -= 3;
  if (parsed.color && !includes(tAll, parsed.color)) score -= 4;
  return { score };
}
function pickVariant(p: Product, size?: string): Variant | undefined {
  if (size) {
    const exact = p.variants.find(v => norm(v.title) === norm(size));
    if (exact && exact.available) return exact;
    const fuzzy = p.variants.find(v => includes(v.title, size));
    if (fuzzy && fuzzy.available) return fuzzy;
  }
  return p.variants.find(v => v.available) || p.variants[0];
}

export default function VoiceAssistant({ welcomeMessage, products }: VoiceAssistantProps) {
  const initialWelcome = welcomeMessage || "Clique sur 🎤 pour parler. Tu peux aussi taper dans le champ.";
  const catalog: Product[] = Array.isArray(products) && products.length > 0 ? products : (defaultProducts as any as Product[]);

  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [assistant, setAssistant] = useState(initialWelcome);
  const [results, setResults] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [resultsDbg, setResultsDbg] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string|undefined>(undefined);

  const recRef = useRef<any>(null);
  const stopTimerRef = useRef<any>(null);

  useEffect(() => { setCart(readCart()); }, []);

  function clearStopTimer() { if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; } }
  function armStopTimer() { clearStopTimer(); stopTimerRef.current = setTimeout(() => { stopListening(); }, 8000); }

  async function ensureMicPermission() {
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); return true; }
    catch { setErrorMsg("Accès au micro refusé. Autorise le micro (icône 🔒) puis réessaie."); return false; }
  }

  const startListening = async () => {
    setErrorMsg(undefined);
    if (!supportSTT()) { setAssistant("Ton navigateur ne supporte pas la reconnaissance vocale. Utilise Google Chrome pour tester."); return; }
    const ok = await ensureMicPermission(); if (!ok) return;

    const Ctor = getRecognizerCtor();
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = true;

    setPartial(""); setFinalText(""); setResults([]); setSuggestions([]); setResultsDbg([]);
    setAssistant("J'écoute… parle clairement près du micro.");
    setListening(true);

    rec.onaudiostart = () => armStopTimer();
    rec.onsoundstart = () => armStopTimer();
    rec.onspeechstart = () => armStopTimer();
    rec.onresult = (e: any) => {
      armStopTimer();
      let latestPartial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        latestPartial = res[0].transcript;
        if (res.isFinal) { setFinalText(prev => (prev ? prev + " " : "") + res[0].transcript); setPartial(""); }
        else { setPartial(latestPartial); }
      }
    };
    rec.onerror = () => { setErrorMsg("Erreur micro/reconnaissance."); setListening(false); clearStopTimer(); };
    rec.onend = () => { setListening(false); clearStopTimer(); const text = (finalText || partial || "").trim(); if (text.length > 0) handleUserQuery(text); else setAssistant("Je n'ai rien entendu. Clique sur 🎤 et essaie encore."); };

    recRef.current = rec;
    setTimeout(() => { try { rec.start(); } catch {} }, 150);
  };
  const stopListening = () => { try { recRef.current?.stop(); } catch {} };

  function onAdd(p: Product, v: Variant, qty = 1) {
    const lines = readCart();
    const idx = lines.findIndex(l => l.variantId === v.id);
    if (idx >= 0) lines[idx].qty += qty;
    else lines.push({ variantId: v.id, productId: p.id, title: p.title, variantTitle: v.title, price: v.price, currency: v.currency, qty, image: p.image });
    writeCart(lines); setCart(lines);
    const msg = `${qty} × ${p.title} (${v.title}) ajouté${qty>1?"s":""} au panier.`; setAssistant(msg); speak(msg);
  }

  function addFromIntent(parsed: ParsedQuery) {
    let candidates: Product[] = catalog;

    if (parsed.productType) {
      const byType = catalog.filter(p => includes(`${p.tags.join(" ")} ${p.title}`, parsed.productType!));
      if (byType.length > 0) candidates = byType;
    }
    if (parsed.color) {
      const byColor = candidates.filter(p => includes(`${p.tags.join(" ")} ${p.title}`, parsed.color!));
      if (byColor.length > 0) candidates = byColor;
    }
    if (candidates.length === 0) {
      const msg = "Je n’ai pas trouvé ce type/cette couleur. Peux-tu préciser le modèle ?";
      setAssistant(msg); speak(msg); return;
    }

    const ranked = candidates.map(p => ({ p, ...scoreProduct(p, parsed) }))
                             .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const threshold = 3;
    if (!best || best.score < threshold) {
      const msg = "Je ne suis pas sûr de l’article. Dis-moi le type (ex. baskets), la couleur et la taille.";
      setAssistant(msg); speak(msg); return;
    }

    const product = best.p;
    const variant = pickVariant(product, parsed.size);
    if (!variant) {
      const msg = `Aucune variante disponible pour ${product.title}.`;
      setAssistant(msg); speak(msg); return;
    }
    const qty = Math.max(1, parsed.quantity || 1);
    onAdd(product, variant, qty);
  }

  async function handleUserQuery(text: string) {
    const utterance = (text || "").trim();
    if (!utterance) return;

    const parsed = parseUserUtterance(utterance);

    if ((parsed as any).intent === "add_to_cart") {
      addFromIntent(parsed);
      return;
    }

    const summary = toSpokenSummary(parsed);
    setAssistant(summary); speak(summary);

    const { list, debug, suggestions } = filterWithFallbacks(catalog, parsed);
    setResults(list);
    setSuggestions(suggestions);
    setResultsDbg([
      `Critères → type: ${parsed.productType ?? "-"}, couleur: ${parsed.color ?? "-"}, taille: ${parsed.size ?? "-"}, prix: ${parsed.priceMin ?? "-"}-${parsed.priceMax ?? "-"}`,
      ...debug
    ]);

    if (list.length === 0 && suggestions.length === 0) {
      const msg = "Je n'ai rien trouvé. Essaye une autre couleur/tailles, ou un budget différent.";
      setAssistant(msg); speak(msg);
    } else if (list.length < 3 && suggestions.length > 0) {
      speak("Je te propose aussi des alternatives proches.");
    } else {
      speak(`J'ai trouvé ${list.length} résultat${list.length > 1 ? "s" : ""}.`);
    }
  }

  const goCheckout = () => { window.location.href = "/checkout"; };
  const combinedText = (finalText + " " + partial).trim();

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, width: 420, maxWidth: "96vw", zIndex: 9999, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 12px 30px rgba(0,0,0,0.15)", padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={listening ? stopListening : startListening} title={listening ? "Arrêter l'écoute" : "Parler"}
            style={{ width: 48, height: 48, borderRadius: 999, border: "none", cursor: "pointer", background: listening ? "#ef4444" : "#0ea5e9", color: "#fff", fontWeight: 800, fontSize: 18 }}>
            {listening ? "■" : "🎤"}
          </button>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Assistant vocal</div>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            placeholder="Par ex. 'chemise bleue M' ou 'mets au panier les baskets noires en 42'"
            value={combinedText}
            onChange={e => { setFinalText(e.target.value); setPartial(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleUserQuery((e.target as HTMLInputElement).value); }}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => handleUserQuery(combinedText)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Rechercher / Exécuter
            </button>
            <button onClick={() => { setPartial(""); setFinalText(""); setResults([]); setSuggestions([]); setResultsDbg([]); setAssistant(initialWelcome); }}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f3f4f6", cursor: "pointer" }}>
              Effacer
            </button>
            <button onClick={goCheckout} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Panier ({cart.reduce((s, l) => s + l.qty, 0)})
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ marginTop: 8, background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: 10, borderRadius: 10, fontSize: 13 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginTop: 8, background: "#eff6ff", border: "1px solid #dbeafe", color: "#1e3a8a", padding: 10, borderRadius: 10, fontSize: 14 }}>
          {assistant}
        </div>
      </div>

      {resultsDbg.length > 0 && (
        <div style={{ marginTop: 8, background: "#fff", border: "1px solid #e5e7eb", padding: 10, borderRadius: 10, fontSize: 12, color: "#374151" }}>
          {resultsDbg.map((l, i) => <div key={i} style={{ marginBottom: 2 }}>{l}</div>)}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 12px 30px rgba(0,0,0,0.15)", padding: 10, maxHeight: "44vh", overflow: "auto", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Résultats</div>
          <div style={{ display: "grid", gap: 10 }}>
            {results.map(p => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, border: "1px solid #f1f5f9", borderRadius: 10, padding: 8 }}>
                <img src={p.image} alt={p.title} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, background: "#f8fafc" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", maxHeight: 34, overflow: "hidden" }}>{p.description}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {p.variants.map(v => (
                      <button key={v.id} disabled={!v.available} onClick={() => onAdd(p, v)}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: v.available ? "#fff" : "#f3f4f6", cursor: v.available ? "pointer" : "not-allowed", fontSize: 12 }}>
                        {v.title} · {v.price.toFixed(2)} €
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 6px 16px rgba(0,0,0,0.12)", padding: 10, maxHeight: "34vh", overflow: "auto" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Tu pourrais aimer aussi</div>
          <div style={{ display: "grid", gap: 10 }}>
            {suggestions.map(p => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, border: "1px solid #f1f5f9", borderRadius: 10, padding: 8 }}>
                <img src={p.image} alt={p.title} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, background: "#f8fafc" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", maxHeight: 32, overflow: "hidden" }}>{p.description}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {p.variants.map(v => (
                      <button key={v.id} disabled={!v.available} onClick={() => onAdd(p, v)}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: v.available ? "#fff" : "#f3f4f6", cursor: v.available ? "pointer" : "not-allowed", fontSize: 12 }}>
                        {v.title} · {v.price.toFixed(2)} €
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
