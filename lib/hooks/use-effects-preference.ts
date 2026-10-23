"use client";

import { useSyncExternalStore } from "react";

// Preferencia global de animaciones decorativas (fondos del dashboard). La
// landing y las pantallas de acceso ya no dependen de esta preferencia: sus
// efectos son permanentes. Si el usuario usa el switch, su elección se guarda
// y prevalece sobre el valor por defecto. El logo TechText tampoco pasa por
// esta preferencia: su animación es siempre activa.
const STORAGE_KEY = "resolve_effects";
const listeners = new Set<() => void>();

function applyAttribute(value: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(
    "data-effects",
    value ? "on" : "off"
  );
}

function readPreference(defaultEnabled: boolean): boolean {
  if (typeof window === "undefined") return defaultEnabled;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return defaultEnabled;
}

const getSnapshotOn = () => readPreference(true);
const getSnapshotOff = () => readPreference(false);
const getServerSnapshotOn = () => true;
const getServerSnapshotOff = () => false;

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

export function useEffectsPreference(defaultEnabled = false) {
  const effectsEnabled = useSyncExternalStore(
    subscribe,
    defaultEnabled ? getSnapshotOn : getSnapshotOff,
    defaultEnabled ? getServerSnapshotOn : getServerSnapshotOff
  );

  return {
    effectsEnabled,
    setEffectsEnabled,
    toggleEffects: () => setEffectsEnabled(!readPreference(defaultEnabled)),
  };
}
