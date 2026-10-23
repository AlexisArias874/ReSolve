"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// El tema (claro / sepia / matrix) es una preferencia de la app y se aplica a
// todas las ventanas salvo la landing page, que está diseñada dark-first y no
// debe heredarlo: su fondo animado y sus superficies oscuras se "descomponen"
// con un tema claro (p. ej. el velo oscuro sobre una página blanca).
const LANDING_ROUTE = "/";

// Rutas con archivo estático o descargas que no renderizan interfaz: no
// necesitan el atributo, pero tampoco deben activar el tema de la landing.
const IGNORED_PREFIXES = ["/_next", "/api", "/brand", "/favicon"];

export default function ThemeScope() {
  const pathname = usePathname();

  useEffect(() => {
    const isLanding = pathname === LANDING_ROUTE;
    const isIgnored = IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isIgnored) return;

    const root = document.documentElement;

    // La landing conserva siempre el tema oscuro original.
    if (isLanding) {
      if (root.getAttribute("data-theme") !== "dark") {
        root.setAttribute("data-theme", "dark");
      }
      return;
    }

    // En el resto de ventanas se respeta la preferencia guardada.
    const saved = localStorage.getItem("resolve_theme") || "dark";
    if (root.getAttribute("data-theme") !== saved) {
      root.setAttribute("data-theme", saved);
      window.dispatchEvent(new Event("themechange"));
    }
  }, [pathname]);

  return null;
}
