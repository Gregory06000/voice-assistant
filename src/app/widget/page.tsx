// src/app/widget/page.tsx
import { Suspense } from "react";
import ClientWidget from "./ClientWidget";

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
        }}>
          Chargement du widget…
        </div>
      }
    >
      <ClientWidget />
    </Suspense>
  );
}
