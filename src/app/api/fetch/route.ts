// src/app/api/fetch/route.ts
import { NextResponse } from "next/server";

const MAX_BYTES = 2_000_000; // 2 Mo
const TIMEOUT_MS = 8000;

function isHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target || !isHttpUrl(target)) {
    return NextResponse.json({ error: "Paramètre 'url' manquant ou invalide." }, { status: 400 });
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(to);

    if (!res.ok) {
      return NextResponse.json({ error: `Erreur HTTP ${res.status}` }, { status: 502 });
    }

    // Limite de taille via en-tête
    const len = Number(res.headers.get("content-length") || "0");
    if (len && len > MAX_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
    }

    // Lis le JSON (et recontrôle la taille après lecture)
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });
    }

    // Tente de parser JSON
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json({ error: "Réponse distante non-JSON." }, { status: 415 });
    }
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Délai dépassé" : "Échec du chargement distant" },
      { status: aborted ? 504 : 502 }
    );
  }
}
