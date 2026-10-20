"use client";

// =============================================================================
// ReSolve · StaggeredMenu
// -----------------------------------------------------------------------------
// Menú lateral con entrada escalonada (inspirado en React Bits). Se usa como
// desplegable de navegación en el dashboard y como selector de filtros en el
// historial. Los colores se reciben por props para respetar el tema activo.
// =============================================================================

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, X } from "lucide-react";

export interface StaggeredMenuItem {
  label: string;
  ariaLabel?: string;
  link?: string;
  external?: boolean;
  transitionTypes?: string[];
  onClick?: () => void;
}

export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}

export interface StaggeredMenuProps {
  position?: "left" | "right";
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  logoUrl?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  changeMenuColorOnOpen?: boolean;
  accentColor?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export default function StaggeredMenu({
  position = "right",
  colors = ["#120F17", "#5227FF", "#B497CF"],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  logoUrl,
  menuButtonColor = "var(--shell-muted)",
  openMenuButtonColor = "var(--foreground)",
  changeMenuColorOnOpen = true,
  accentColor = "var(--shell-active)",
  triggerLabel = "Menú",
  triggerClassName = "",
  onMenuOpen,
  onMenuClose,
}: StaggeredMenuProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) onMenuOpen?.();
    else onMenuClose?.();
    // El callback pertenece a la transición de apertura/cierre, no a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const offscreen = position === "left" ? "-100%" : "100%";
  const panelColors = colors.length ? colors : ["#120F17", "#5227FF"];
  const prelayers = panelColors.slice(0, 3);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ color: changeMenuColorOnOpen && open ? openMenuButtonColor : menuButtonColor }}
        className={triggerClassName}
      >
        <span>{triggerLabel}</span>
        <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
          <Plus size={14} strokeWidth={2} />
        </span>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[90] overflow-hidden" aria-live="polite">
                <motion.button
                  type="button"
                  aria-label="Cerrar menú"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={close}
                  className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
                />

                <div
                  className={`pointer-events-none absolute inset-y-0 flex w-full max-w-[min(100vw,470px)] ${
                    position === "left" ? "left-0" : "right-0"
                  }`}
                >
                  {prelayers.map((color, index) => (
                    <motion.div
                      key={`${color}-${index}`}
                      aria-hidden="true"
                      initial={{ x: reduce ? 0 : offscreen }}
                      animate={{ x: 0 }}
                      exit={{ x: offscreen }}
                      transition={{
                        duration: reduce ? 0 : 0.58,
                        delay: reduce ? 0 : index * 0.065,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="pointer-events-none absolute inset-0"
                      style={{ background: color }}
                    />
                  ))}

                  <motion.aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    initial={{ x: reduce ? 0 : offscreen }}
                    animate={{ x: 0 }}
                    exit={{ x: offscreen }}
                    transition={{ duration: reduce ? 0 : 0.62, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-auto relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-shell-hairline p-6 pt-5 shadow-2xl backdrop-blur-2xl sm:p-8"
                    style={{
                      background: `color-mix(in oklab, ${panelColors[0]} 88%, transparent)`,
                      color: "var(--foreground)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt="ReSolve"
                          width={126}
                          height={34}
                          className="h-8 w-auto object-contain"
                          priority={false}
                        />
                      ) : (
                        <span className="font-serif text-lg font-bold tracking-tight">ReSolve</span>
                      )}
                      <button
                        type="button"
                        onClick={close}
                        aria-label="Cerrar menú"
                        className="rounded-full border border-shell-hairline bg-shell-surface p-2 text-shell-muted transition-colors hover:bg-shell-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-active/40"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <motion.ul
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: {},
                        show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: reduce ? 0 : 0.18 } },
                      }}
                      className="mt-10 flex list-none flex-col gap-1 p-0"
                      aria-label="Navegación"
                    >
                      {items.map((item, index) => (
                        <motion.li
                          key={`${item.label}-${index}`}
                          variants={{
                            hidden: { opacity: 0, y: reduce ? 0 : 34, rotate: reduce ? 0 : 2 },
                            show: {
                              opacity: 1,
                              y: 0,
                              rotate: 0,
                              transition: { duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] },
                            },
                          }}
                          className="overflow-hidden"
                        >
                          {item.link && !item.external ? (
                            <Link
                              href={item.link}
                              onClick={close}
                              transitionTypes={item.transitionTypes}
                              aria-label={item.ariaLabel ?? item.label}
                              className="group flex items-baseline gap-3 py-1 text-[clamp(1.75rem,5vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-foreground transition-colors hover:text-[var(--sm-accent)] focus-visible:outline-none focus-visible:text-[var(--sm-accent)]"
                              style={{ ["--sm-accent" as string]: accentColor }}
                            >
                              {displayItemNumbering && (
                                <span className="font-mono text-[11px] font-normal tracking-normal text-[var(--sm-accent)] opacity-80">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              )}
                              <span>{item.label}</span>
                            </Link>
                          ) : item.link && item.external ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={close}
                              aria-label={item.ariaLabel ?? item.label}
                              className="group flex items-baseline gap-3 py-1 text-[clamp(1.75rem,5vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-foreground transition-colors hover:text-[var(--sm-accent)] focus-visible:outline-none focus-visible:text-[var(--sm-accent)]"
                              style={{ ["--sm-accent" as string]: accentColor }}
                            >
                              {displayItemNumbering && (
                                <span className="font-mono text-[11px] font-normal tracking-normal text-[var(--sm-accent)] opacity-80">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              )}
                              <span>{item.label}</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                item.onClick?.();
                                close();
                              }}
                              aria-label={item.ariaLabel ?? item.label}
                              className="group flex w-full items-baseline gap-3 py-1 text-left text-[clamp(1.75rem,5vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-foreground transition-colors hover:text-[var(--sm-accent)] focus-visible:outline-none focus-visible:text-[var(--sm-accent)]"
                              style={{ ["--sm-accent" as string]: accentColor }}
                            >
                              {displayItemNumbering && (
                                <span className="font-mono text-[11px] font-normal tracking-normal text-[var(--sm-accent)] opacity-80">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              )}
                              <span>{item.label}</span>
                            </button>
                          )}
                        </motion.li>
                      ))}
                    </motion.ul>

                    {displaySocials && socialItems.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : 0.5, duration: reduce ? 0 : 0.4 }}
                        className="mt-auto border-t border-shell-hairline pt-6"
                      >
                        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-shell-muted">Enlaces</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {socialItems.map((social) => (
                            <a
                              key={social.label}
                              href={social.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-shell-muted transition-colors hover:text-[var(--sm-accent)]"
                              style={{ ["--sm-accent" as string]: accentColor }}
                            >
                              {social.label}
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <span id={titleId} className="sr-only">
                      Menú de navegación
                    </span>
                  </motion.aside>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
