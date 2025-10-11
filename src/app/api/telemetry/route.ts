// src/app/api/telemetry/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Pour la démo : on logge côté serveur (visible dans les logs Vercel)
    console.log("[telemetry]", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
