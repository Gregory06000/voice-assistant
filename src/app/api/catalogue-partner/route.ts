// src/app/api/catalogue-partner/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // 👇 Exemple mini-catalogue “partenaire”
  const partnerProducts = [
    {
      id: "sneakers-noires-pro",
      title: "Sneakers noires PRO",
      description: "Modèle partenaire, semelle confort.",
      image: "/images/baskets-noires.jpg",
      tags: ["baskets", "sneakers", "noir", "chaussures"],
      variants: [
        { id: "sneakers-noires-pro-41", title: "41", price: 69, currency: "EUR", available: true },
        { id: "sneakers-noires-pro-42", title: "42", price: 69, currency: "EUR", available: true }
      ]
    },
    {
      id: "robe-rouge-coton",
      title: "Robe rouge en coton",
      description: "Coupe aérienne, idéale été.",
      image: "/images/robe-rouge.jpg",
      tags: ["robe", "rouge", "femme"],
      variants: [
        { id: "robe-rouge-s", title: "S", price: 49, currency: "EUR", available: true },
        { id: "robe-rouge-m", title: "M", price: 49, currency: "EUR", available: true }
      ]
    }
  ];
  return NextResponse.json(partnerProducts, {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" },
  });
}
