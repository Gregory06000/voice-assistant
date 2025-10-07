// src/app/widget/page.tsx
import dynamicImport from "next/dynamic";

// ⚠️ Rend cette page uniquement côté client (pas de SSR)
const ClientWidget = dynamicImport(() => import("./ClientWidget"), {
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

// Empêche tout prérendu
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WidgetPage() {
  return <ClientWidget />;
}
