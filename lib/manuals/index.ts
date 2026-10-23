import type { ManualDefinition, ManualId } from "./types";
import { TECHNICAL_MANUAL } from "./technical";
import { ADMIN_MANUAL } from "./admin";
import { USER_MANUAL } from "./user";

export const MANUALS: Record<ManualId, ManualDefinition> = {
  tecnico: TECHNICAL_MANUAL,
  administrativo: ADMIN_MANUAL,
  usuario: USER_MANUAL,
};

export function getManual(id: string): ManualDefinition | undefined {
  return MANUALS[id as ManualId];
}

export { MANUAL_IDS } from "./types";
export type { ManualId, ManualDefinition, ManualSection, ManualBlock } from "./types";
