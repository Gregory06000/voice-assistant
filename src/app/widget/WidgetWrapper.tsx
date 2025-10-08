// src/app/widget/WidgetWrapper.tsx
"use client";

import dynamic from "next/dynamic";

const ClientWidget = dynamic(() => import("./ClientWidget"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      Chargement du widget…
    </div>
  ),
});

export default function WidgetWrapper() {
  return <ClientWidget />;
}
