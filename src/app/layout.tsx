import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caja Nequi — Farmacia Biogreen",
  description: "Registro y cuadre de movimientos Nequi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema guardado ANTES del primer pintado (evita el parpadeo blanco al cargar en
// modo noche/oscuro). Corre inline en <head>; debe ser mínimo y a prueba de errores.
const themeInitScript = `try{var t=localStorage.getItem("biogreen-tema");if(t==="noche"||t==="oscuro")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: el script inline puede poner data-theme en <html> antes de
    // que React hidrate; sin esto React se quejaría de la diferencia servidor/cliente.
    <html lang="es" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
        <ThemeSwitcher />
      </body>
    </html>
  );
}
