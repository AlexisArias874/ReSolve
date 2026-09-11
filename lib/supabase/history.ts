import { createClient } from "@/lib/supabase/client";

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

export async function fetchUserHistory(module: string, subtopic: string): Promise<HistoryItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Si no está autenticado, lee de localStorage
  if (!user) {
    try {
      const local = localStorage.getItem(`resolve_history_${subtopic}`);
      return local ? JSON.parse(local) : [];
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

  return (data || []).map((row) => ({
    id: row.id,
    expression: row.expression,
    result: row.result,
    timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
}

export async function saveUserCalculation(
  module: string,
  subtopic: string,
  expression: string,
  result: string
): Promise<void> {
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