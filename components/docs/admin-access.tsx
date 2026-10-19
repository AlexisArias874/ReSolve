"use client";

// =============================================================================
// ReSolve · Acceso de administrador
// -----------------------------------------------------------------------------
// Se muestra cuando la cuenta actual no tiene el rol. Explica cómo crear la
// tabla de fechas y cómo conceder `app_metadata.role = "admin"` en Supabase.
// =============================================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Check, Copy, Database, RefreshCw, ShieldCheck, UserCog, X } from "lucide-react";
import { ROLE_SQL, SCHEMA_SQL } from "@/lib/documentation/admin";

export function AdminAccessDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<"schema" | "role" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const copy = async (kind: "schema" | "role", sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard bloqueado */
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Acceso de administrador"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-xl text-zinc-100">
              <ShieldCheck size={19} className="text-amber-400" /> Acceso de administrador
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              El rol se concede desde Supabase y permite editar las fechas de los
              calendarios. No se puede activar desde el navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <ol className="space-y-3 text-xs text-zinc-300">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-[10px]">
                1
              </span>
              <span>
                Inicia sesión en ReSolve con la cuenta que será administradora.
                Si aún no la tienes, regístrala desde <strong>Crear cuenta</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-[10px]">
                2
              </span>
              <span>
                En Supabase, abre <strong>SQL Editor</strong> y ejecuta el bloque de
                la tabla. Solo hace falta una vez.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-[10px]">
                3
              </span>
              <span>
                Ejecuta el bloque del rol cambiando el correo por el de tu cuenta.
                Luego recarga esta página.
              </span>
            </li>
          </ol>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <Database size={13} className="text-sky-400" /> 1 · Tabla y políticas
              </span>
              <button
                type="button"
                onClick={() => copy("schema", SCHEMA_SQL)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700"
              >
                {copied === "schema" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "schema" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-52 overflow-auto px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
              <code>{SCHEMA_SQL}</code>
            </pre>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <UserCog size={13} className="text-emerald-400" /> 2 · Conceder el rol
              </span>
              <button
                type="button"
                onClick={() => copy("role", ROLE_SQL)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700"
              >
                {copied === "role" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "role" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-40 overflow-auto px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
              <code>{ROLE_SQL}</code>
            </pre>
          </section>

          <p className="text-[11px] leading-relaxed text-zinc-500">
            Tras conceder el rol, cierra sesión y vuelve a entrar (o refresca la
            sesión) para que el token incluya <code>role = &quot;admin&quot;</code>.
          </p>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-zinc-800/80 px-5 py-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <RefreshCw size={13} /> Recargar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-white"
          >
            Entendido
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
