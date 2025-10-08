// src/app/api/catalogue-partner/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const products = [
    {
      id: "sneakers-noires-pro",
      title: "Sneakers noires PRO",
      description: "Modèle partenaire, semelle confort.",
      image:
        "https://images.unsplash.com/photo-1520974722053-49e0b0b9c3d6?q=80&w=640&auto=format&fit=crop",
      tags: ["baskets", "sneakers", "noir", "chaussures"],
      variants: [
        { id: "sneakers-noires-pro-41", title: "41", price: 69, currency: "EUR", available: true },
        { id: "sneakers-noires-pro-42", title: "42", price: 69, currency: "EUR", available: true }
      ]
    },
    {
      id: "chemise-lin-bleu",
      title: "Chemise en lin bleu",
      description: "Chemise légère 100% lin, idéale pour l’été. Coupe régulière.",
      image:
        "https://images.unsplash.com/photo-1516826957135-700dedea698c?q=80&w=640&auto=format&fit=crop",
      tags: ["chemise", "bleu", "homme", "lin"],
      variants: [
        { id: "chemise-lin-bleu-s", title: "S", price: 49.9, currency: "EUR", available: true },
        { id: "chemise-lin-bleu-m", title: "M", price: 49.9, currency: "EUR", available: true },
        { id: "chemise-lin-bleu-l", title: "L", price: 49.9, currency: "EUR", available: false }
      ]
    },
    {
      id: "chemise-coton-blanche",
      title: "Chemise en coton blanche",
      description: "Chemise classique 100% coton, col français.",
      image:
        "https://images.unsplash.com/photo-1520975693410-0016d1a53c7b?q=80&w=640&auto=format&fit=crop",
      tags: ["chemise", "blanc", "homme", "coton"],
      variants: [
        { id: "chemise-coton-blanche-s", title: "S", price: 39.9, currency: "EUR", available: true },
        { id: "chemise-coton-blanche-m", title: "M", price: 39.9, currency: "EUR", available: true },
        { id: "chemise-coton-blanche-l", title: "L", price: 39.9, currency: "EUR", available: true }
      ]
    },
    {
      id: "robe-bleu-marine",
      title: "Robe bleu marine",
      description: "Robe élégante, manches courtes, matière fluide.",
      image:
        "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=640&auto=format&fit=crop",
      tags: ["robe", "bleu", "femme"],
      variants: [
        { id: "robe-bleu-marine-s", title: "S", price: 64.9, currency: "EUR", available: true },
        { id: "robe-bleu-marine-m", title: "M", price: 64.9, currency: "EUR", available: true }
      ]
    }
  ];

  return NextResponse.json(products, {
    headers: { "Cache-Control": "no-store" }
  });
}
