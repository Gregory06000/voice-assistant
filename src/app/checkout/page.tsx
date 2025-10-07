"use client";

import { useEffect, useState } from "react";

type CartLine = { variantId: string; productId: string; title: string; variantTitle: string; price: number; currency: string; qty: number; image: string };

function readCart(): CartLine[] {
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
}
function writeCart(lines: CartLine[]) {
  localStorage.setItem("cart", JSON.stringify(lines));
}

export default function CheckoutPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => { setLines(readCart()); }, []);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  function inc(i: number) { const copy = [...lines]; copy[i].qty += 1; setLines(copy); writeCart(copy); }
  function dec(i: number) { const copy = [...lines]; copy[i].qty = Math.max(1, copy[i].qty - 1); setLines(copy); writeCart(copy); }
  function remove(i: number) { const copy = [...lines]; copy.splice(i, 1); setLines(copy); writeCart(copy); }
  function confirm() { setDone(true); localStorage.removeItem("cart"); }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Merci 🎉</h1>
        <p>Commande simulée : ceci est un checkout de démonstration gratuit.</p>
        <a href="/" style={{ display: "inline-block", marginTop: 10, padding: "10px 14px", background: "#0ea5e9", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>
          Retour à la boutique
        </a>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Votre panier</h1>
      {lines.length === 0 ? (
        <p>Votre panier est vide.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
          {lines.map((l, i) => (
            <div key={l.variantId} style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
              <img src={l.image} alt={l.title} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, background: "#f1f5f9" }} />
              <div>
                <div style={{ fontWeight: 700 }}>{l.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Variante : {l.variantTitle}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => dec(i)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f3f4f6" }}>-</button>
                  <div>{l.qty}</div>
                  <button onClick={() => inc(i)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f3f4f6" }}>+</button>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{(l.price * l.qty).toFixed(2)} €</div>
                <button onClick={() => remove(i)} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fee2e2", color: "#991b1b" }}>
                  Retirer
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{total.toFixed(2)} €</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f3f4f6", textDecoration: "none", color: "#111827" }}>
              Continuer mes achats
            </a>
            <button onClick={confirm} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#16a34a", color: "#fff", fontWeight: 700 }}>
              Confirmer la commande (démo)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
