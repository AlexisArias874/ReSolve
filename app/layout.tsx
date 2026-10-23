import type { Metadata } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import ThemeScope from "@/components/shared/theme-scope";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const serif = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ReSolve",
  description: "Suite matemática integral para ciencias de la computación e ingeniería",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Inyector instantáneo de tema guardado. El tema es una preferencia de
            la app: se aplica a todas las ventanas salvo la landing page, que
            permanece siempre en oscuro. Se ejecuta antes del primer pintado
            para evitar destellos al navegar entre secciones. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const path = location.pathname;
                const isLanding = path === '/';
                const savedTheme = localStorage.getItem('resolve_theme') || 'dark';
                document.documentElement.setAttribute('data-theme', isLanding ? 'dark' : savedTheme);
                const savedEffects = localStorage.getItem('resolve_effects');
                const defaultEffects = isLanding ? 'on' : 'off';
                document.documentElement.setAttribute(
                  'data-effects',
                  savedEffects === '1' ? 'on' : savedEffects === '0' ? 'off' : defaultEffects
                );
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${serif.variable} font-sans antialiased bg-zinc-950 text-zinc-50`}>
        <ThemeScope />
        {children}
      </body>
    </html>
  );
}