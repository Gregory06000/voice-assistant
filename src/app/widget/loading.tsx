// src/app/widget/loading.tsx
export default function Loading() {
  return (
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
  );
}
