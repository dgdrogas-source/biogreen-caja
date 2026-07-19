import { NextResponse } from "next/server";

// Endpoint público de salud/verificación de deploys (2026-07-17). Devuelve el commit que
// está sirviendo Vercel (VERCEL_GIT_COMMIT_SHA la inyecta Vercel en build). Sin datos de
// negocio ni auth: solo confirma qué versión está en vivo — permite verificar un deploy
// desde fuera sin credenciales (antes solo se podía adivinar por rutas nuevas 404→307).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
