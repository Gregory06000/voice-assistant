// src/app/widget/ClientWidget.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import VoiceAssistant from "../components/VoiceAssistant";

type Variant = { id: string; title: string; price: number; currency: string; available: boolean };
type Product = { id: string; title: string; description: string; image: string; variants: Variant[]; tags: string[] };

function normalizeImage(urlStr: string, catalogUrl: string): string {
  try {
    // URL absolue ? on renvoie tel quel
    if (/^https?:\/\//i.test(urlStr)) return urlStr;
    // chemin absolu site (/images/...) → on le résout sur l'origin du catalogue
    const base = new URL(catalogUrl);
    if (urlStr.startsWith("/")) {
      return `${base.origin}${urlStr}`;
    }
    // chemin relatif (images/...) → on le résout contre l’URL complète du catalogue
    return new URL(urlStr, catalogUrl).toString();
  } catch {
    return urlStr;
  }
}

export default function ClientWidget() {
  const [externalProducts, setExternalProducts] = useState<Product[] | null>(null);
  const [welcome, setWelcome] = useState<string | undefined>(undefined);

  useEffect(() => {
    const url = new URL(window.location.href);
    const catalog = url.searchParams.get("catalog");
    const welcomeParam = url.searchParams.get("welcome") || undefined;
    setWelcome(welcomeParam);

    if (!catalog) return;

    const proxied = `${window.location.origin}/api/fetch?url=${encodeURIComponent(catalog)}`;

    fetch(proxied, { cache: "no-store" })
      .then(r => r.json())
      .then((data) => {
        let products: Product[] | null = null;

        if (Array.isArray(data)) products = data as Product[];
        else if (Array.isArray((data as any).products)) products = (data as any).products as Product[];
        else products = null;

        if (products && catalog) {
          products = products.map(p => ({
            ...p,
            image: p.image ? normalizeImage(p.image, catalog) : p.image,
          }));
        }

        setExternalProducts(products);
      })
      .catch(() => setExternalProducts(null));
  }, []);

  const props = useMemo(() => ({
    welcomeMessage: welcome,
    products: externalProducts || undefined,
  }), [welcome, externalProducts]);

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "transparent" }}>
      <VoiceAssistant {...props} />
    </div>
  );
}
