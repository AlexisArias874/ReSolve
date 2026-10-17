"use client";

import { useSyncExternalStore } from "react";

// Preferencia global y persistente: ocultar/mostrar la sección de historial en
// todas las vistas. Se comparte entre la cabecera del dashboard y cada módulo.
const STORAGE_KEY = "resolve_history_hidden";
const listeners = new Set<() => void>();

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

export function setHistoryHidden(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  listeners.forEach((listener) => listener());
}

export function useHistoryVisibility() {
  const isHistoryHidden = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return {
    isHistoryHidden,
    setIsHistoryHidden: setHistoryHidden,
    toggleHistory: () => setHistoryHidden(!getSnapshot()),
  };
}
