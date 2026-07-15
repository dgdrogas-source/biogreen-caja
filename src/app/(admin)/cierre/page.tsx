import { redirect } from "next/navigation";

// El hub de cierres ahora es la pantalla de inicio del admin (/inicio).
// Esta ruta queda solo para no romper enlaces/bookmarks viejos a /cierre.
export default function CierrePage() {
  redirect("/inicio");
}
