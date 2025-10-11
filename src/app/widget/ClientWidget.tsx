"use client";

import { useEffect, useMemo, useState } from "react";
import VoiceAssistant from "../components/VoiceAssistant";
import { z } from "zod";
import {
  CatalogArraySchema,
  CatalogWrappedSchema,
  Product as ProductType,
} from "../../lib/catalogSchema";

// ——— Normalisation d’URL d’image (absolues ET relatives) ———
function normalizeImage(urlStr: string | undefined, catalogUrl: string): string | undefined {
  if (!urlStr) return urlStr;
  try {
    if (/^https?:\/\//i.test(urlStr)) return urlStr; // déjà absolu
    const base = new URL(catalogUrl);
    if (urlStr.startsWith("/")) return `${base.origin}${urlStr}`; // absolu "site"
    return new URL(urlStr, catalogUrl).toString(); // relatif
  } catch {
    return urlStr;
  }
}

export default function ClientWidget() {
  const [externalProducts, setExternalProducts] = useState<ProductType[] | null>(null);
  const [welcome, setWelcome] = useState<string | undefined>(undefined);
  const [brandColor, setBrandColor] = useState<string | undefined>(undefined);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);

    // Paramètres supportés :
    //   ?catalog=<URL JSON publique>
    //   ?welcome=<message d’accueil>
    //   ?color=#ff6600
    //   ?tts=1
    const catalog = url.searchParams.get("catalog");
    const welcomeParam = url.searchParams.get("welcome") || undefined;
    const color = url.searchParams.get("color") || undefined;
    const tts = url.searchParams.get("tts");

    setWelcome(welcomeParam);
    if (color) setBrandColor(color);
    setTtsEnabled(tts === "1" || tts === "true");

    if (!catalog) {
      // pas de catalogue externe : VoiceAssistant utilisera le local
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const proxied = `${window.location.origin}/api/fetch?url=${encodeURIComponent(catalog)}`;

    fetch(proxied, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Catalogue HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        // 1) Valide le format (tableau ou { products: [...] })
        let products: ProductType[] | null = null;

        if (Array.isArray(data)) {
          const parsed = CatalogArraySchema.safeParse(data);
          if (!parsed.success) {
            throw new Error("Le catalogue n'est pas un tableau valide.");
          }
          products = parsed.data;
        } else if (z.object({ products: z.any() }).safeParse(data).success) {
          const parsed = CatalogWrappedSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error("Le catalogue { products: [...] } est invalide.");
          }
          products = parsed.data.products;
        } else {
          throw new Error("Format de catalogue inconnu (attendu: tableau de produits).");
        }

        // 2) Normalise les images (si relatives)
        const withImages = products.map((p) => ({
          ...p,
          image: normalizeImage(p.image, catalog),
        }));

        setExternalProducts(withImages);
      })
      .catch((err: any) => {
        console.error("Catalogue load error:", err);
        setExternalProducts(null);
        setErrorMsg(
          "Impossible de charger ou valider le catalogue externe. Vérifie l’URL/format."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const propsForAssistant = useMemo(
    () => ({
      welcomeMessage: welcome,
      products: externalProducts || undefined,
      brandColor,
      ttsEnabled,
    }),
    [welcome, externalProducts, brandColor, ttsEnabled]
  );

  // Petit badge d’état (facultatif)
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "transparent",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          maxWidth: 420,
          zIndex: 999998,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        {loading && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e40af",
              padding: "8px 10px",
              borderRadius: 10,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            Chargement du catalogue externe…
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "8px 10px",
              borderRadius: 10,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}
        {externalProducts && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#14532d",
              padding: "8px 10px",
              borderRadius: 10,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            Catalogue externe chargé ({externalProducts.length} produits).
          </div>
        )}
      </div>

      <VoiceAssistant {...propsForAssistant} />
    </div>
  );
}
