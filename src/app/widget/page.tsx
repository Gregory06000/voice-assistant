// src/app/widget/page.tsx
import WidgetWrapper from "./WidgetWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WidgetPage() {
  return <WidgetWrapper />;
}
