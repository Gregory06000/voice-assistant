// src/app/api/catalogue/route.ts
import { NextResponse } from "next/server";
import products from "@/data/products.json";

export async function GET() {
  return NextResponse.json(products, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
