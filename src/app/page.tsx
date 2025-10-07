// src/app/page.tsx
import VoiceAssistant from "./components/VoiceAssistant";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Boutique démo — Assistant vocal (gratuit)</h1>
      <p style={{ color: "#475569", maxWidth: 700 }}>
        Clique sur 🎤 pour parler (Chrome conseillé). Exemple : <i>“Je cherche une chemise bleue taille M à moins de 60 euros.”</i>
        L’assistant te répond à voix haute, affiche les résultats, et tu peux ajouter au panier.
      </p>

      <div style={{ marginTop: 20, padding: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <p style={{ margin: 0 }}>
          Prototype 100% gratuit : voix via le navigateur (Web Speech API), compréhension simple, catalogue local JSON, panier en localStorage, checkout de démonstration.
        </p>
      </div>

      <VoiceAssistant />
    </main>
  );
}
