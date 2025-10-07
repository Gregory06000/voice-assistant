// src/app/widget/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import VoiceAssistant from "../components/VoiceAssistant";

export default function WidgetPage() {
  const search = useSearchParams();
  const welcome = search.get("welcome") || undefined;
  const theme   = search.get("theme")   || undefined;
  const catalog = search.get("catalog") || undefined;

  // Pour l’instant on n’applique que 'welcome' (message d’accueil).
  // 'theme' et 'catalog' serviront ensuite (thème visuel & catalogue externe).
  const props = useMemo(() => ({
    welcomeMessage: welcome
  }), [welcome]);

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "transparent" }}>
      <VoiceAssistant {...props} />
    </div>
  );
}
