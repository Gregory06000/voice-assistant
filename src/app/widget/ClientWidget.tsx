// src/app/widget/ClientWidget.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import VoiceAssistant from "../components/VoiceAssistant";

type Variant = { id: string; title: string; price: number; currency: string; available: boolean };
type Product = { id: string; title: string; description: string; image: string; variants: Variant[]; tags: string[] };

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
        if (Array.isArray(data)) setExternalProducts(data as Product[]);
        else if (Array.isArray((data as any).products)) setExternalProducts((data as any).products);
        else setExternalProducts(null);
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
