"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// El tema (claro / sepia / matrix) es una preferencia de la app y solo se
// aplica dentro del dashboard. Las páginas públicas (landing, auth, historial)
// están diseñadas dark-first y no deben heredarlo: si el tema se filtra, sus
// fondos animados y superficies oscuras se "descomponen" (p. ej. el velo
// oscuro del fondo sobre una página clara).
const APP_ROUTE_PREFIXES = ["/dashboard"];

export default function ThemeScope() {
  const pathname = usePathname();

  useEffect(() => {
    const isAppRoute = APP_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (isAppRoute) return;

    // Fuera de la app: tema oscuro base (las reglas [data-theme] no coinciden
    // con "dark", así que se aplica el diseño original dark-first).
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== "dark") {
      root.setAttribute("data-theme", "dark");
    }
  }, [pathname]);

  return null;
}
