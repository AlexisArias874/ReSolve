import { createClient } from "@/lib/supabase/client";

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
  /**
   * Snapshot JSON de los datos de entrada del cálculo (opcional). Permite
   * restaurar en el formulario los valores que originaron el resultado, no solo
   * mostrarlo. Se guarda en una caché local indexada por subtema + contenido.
   */
  payload?: string;
}

// -----------------------------------------------------------------------------
// Caché local de payloads
// -----------------------------------------------------------------------------
// El payload (snapshot de entradas) no forma parte del esquema de la tabla
// `user_history`, así que se guarda en una caché de localStorage indexada por
// subtema y por el contenido (`expression` + `result`). Se recupera al listar el
// historial, tanto para invitados como para usuarios autenticados en el mismo
// navegador. Es un extra restaurable: si falta, el historial sigue funcionando.

const memoryPayloads = new Map<string, string>();

function hashString(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function payloadKey(subtopic: string, expression: string, result: string): string {
  return `resolve_history_payload_${subtopic}_${hashString(`${expression}|${result}`)}`;
}

function storePayload(
  subtopic: string,
  expression: string,
  result: string,
  payload: string
): void {
  const key = payloadKey(subtopic, expression, result);
  memoryPayloads.set(key, payload);
  try {
    localStorage.setItem(key, payload);
  } catch {
    // localStorage no disponible; queda solo en memoria para esta sesión.
  }
}

function loadPayload(
  subtopic: string,
  expression: string,
  result: string
): string | undefined {
  const key = payloadKey(subtopic, expression, result);
  if (memoryPayloads.has(key)) return memoryPayloads.get(key);
  try {
    return localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Recupera el snapshot tipado de un elemento del historial. Devuelve `null` si no
 * hay payload o si no es JSON válido.
 */
export function readHistoryPayload<T = Record<string, unknown>>(
  item: HistoryItem
): T | null {
  if (!item.payload) return null;
  try {
    return JSON.parse(item.payload) as T;
  } catch {
    return null;
  }
}

export async function fetchUserHistory(module: string, subtopic: string): Promise<HistoryItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const attachPayload = (item: Omit<HistoryItem, "payload">): HistoryItem => ({
    ...item,
    payload: loadPayload(subtopic, item.expression, item.result),
  });

  // Si no está autenticado, lee de localStorage
  if (!user) {
    try {
      const local = localStorage.getItem(`resolve_history_${subtopic}`);
      const parsed: HistoryItem[] = local ? JSON.parse(local) : [];
      return parsed.map((item) => attachPayload(item));
    } catch {
      return [];
    }
  }

  // Si está autenticado, lee de la nube en Supabase
  const { data, error } = await supabase
    .from("user_history")
    .select("id, expression, result, created_at")
    .eq("module", module)
    .eq("subtopic", subtopic)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Error al obtener historial:", error.message);
    return [];
  }

  return (data || []).map((row) =>
    attachPayload({
      id: row.id,
      expression: row.expression,
      result: row.result,
      timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })
  );
}

export async function saveUserCalculation(
  module: string,
  subtopic: string,
  expression: string,
  result: string,
  payload?: string
): Promise<void> {
  if (payload) storePayload(subtopic, expression, result, payload);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Caso Invitado: guarda en LocalStorage
  if (!user) {
    try {
      const local = localStorage.getItem(`resolve_history_${subtopic}`);
      const list: HistoryItem[] = local ? JSON.parse(local) : [];
      if (list[0]?.expression === expression) return;

      const newItem: HistoryItem = {
        id: String(Date.now()),
        expression,
        result,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      localStorage.setItem(`resolve_history_${subtopic}`, JSON.stringify([newItem, ...list.slice(0, 19)]));
    } catch {}
    return;
  }

  // Caso Usuario Registrado: guarda en PostgreSQL (Supabase)
  await supabase.from("user_history").insert({
    user_id: user.id,
    module,
    subtopic,
    expression,
    result,
  });
}

export async function deleteUserHistory(subtopic: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    try {
      localStorage.removeItem(`resolve_history_${subtopic}`);
    } catch {}
    return;
  }

  await supabase.from("user_history").delete().eq("subtopic", subtopic);
}
