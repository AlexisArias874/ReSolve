"use client";

import { useSyncExternalStore } from "react";

// Preferencia global de animaciones decorativas (fondos). Por defecto están
// DESACTIVADAS: el usuario debe activarlas desde el switch. El logo TechText
// no pasa por esta preferencia: su animación es siempre activa.
const STORAGE_KEY = "resolve_effects";
const listeners = new Set<() => void>();

function applyAttribute(value: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(
    "data-effects",
    value ? "on" : "off"
  );
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function setEffectsEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  applyAttribute(value);
  listeners.forEach((listener) => listener());
}

export function useEffectsPreference() {
  const effectsEnabled = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return {
    effectsEnabled,
    setEffectsEnabled,
    toggleEffects: () => setEffectsEnabled(!getSnapshot()),
  };
}
