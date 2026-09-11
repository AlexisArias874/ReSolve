"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Trash2,
  CornerUpLeft,
  Copy,
  Check,
  RotateCcw,
  Calculator,
  Calendar,
  Filter
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FullHistoryRecord {
  id: string;
  module: string;
  subtopic: string;
  expression: string;
  result: string;
  created_at: string;
}

export default function GlobalHistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<FullHistoryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Cargar desde localStorage si es invitado
      try {
        const local = localStorage.getItem("resolve_history_aritmetica");
        if (local) {
          const parsed = JSON.parse(local);
          setRecords(
            parsed.map((item: any) => ({
              id: item.id,
              module: "mat1",
              subtopic: "aritmetica",
              expression: item.expression,
              result: item.result,
              created_at: new Date().toISOString(),
            }))
          );
        }
      } catch {}
      setLoading(false);
      return;
    }

    // Cargar desde Supabase
    const { data, error } = await supabase
      .from("user_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteOne = async (id: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("user_history").delete().eq("id", id);
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm("¿Estás seguro de que deseas vaciar todo tu historial de operaciones?")) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("user_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      localStorage.removeItem("resolve_history_aritmetica");
    }
    setRecords([]);
  };

  const handleRepeat = (record: FullHistoryRecord) => {
    // Redirige al Dashboard cargando la expresión en la URL
    router.push(`/dashboard?expr=${encodeURIComponent(record.expression)}`);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = records.filter((r) => {
    const matchSearch =
      r.expression.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.result.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTopic = selectedSubtopic === "all" || r.subtopic === selectedSubtopic;
    return matchSearch && matchTopic;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none">
      
      {/* Barra Superior */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-serif font-bold text-zinc-100">Historial Global de Cálculos</h1>
            <p className="text-xs text-zinc-400">Auditoría de procedimientos matemáticos y fórmulas evaluadas</p>
          </div>
        </div>

        {records.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3.5 py-2 rounded-xl border border-zinc-800 hover:border-red-900/50 hover:bg-red-950/20 text-zinc-400 hover:text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} /> Vaciar Todo
          </button>
        )}
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Controles de Búsqueda y Filtrado */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar expresión o resultado..."
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Filter size={14} className="text-zinc-500" />
            <select
              value={selectedSubtopic}
              onChange={(e) => setSelectedSubtopic(e.target.value)}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
            >
              <option value="all">Todas las ramas</option>
              <option value="aritmetica">Aritmética (Mat I)</option>
              <option value="algebra">Álgebra (Mat I)</option>
              <option value="matrices">Matrices (Mat IV)</option>
            </select>
          </div>
        </div>

        {/* Listado de Operaciones */}
        <div className="space-y-3 flex-1">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500">Cargando registros...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 border border-dashed border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center text-center">
              <RotateCcw size={28} className="text-zinc-600 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-300">No hay registros coincidentes</h3>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">
                Realiza operaciones en el Dashboard para verlas reflejadas en esta lista.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-mono uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {item.subtopic}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(item.created_at).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <div className="text-base font-mono text-zinc-100 truncate pt-1">
                    {item.expression}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <div className="text-right mr-2">
                    <span className="text-[10px] text-zinc-500 font-mono block">Resultado</span>
                    <span className="text-lg font-serif font-bold text-emerald-400">
                      {item.result}
                    </span>
                  </div>

                  {/* Botón: Repetir / Cargar en Calculadora */}
                  <button
                    onClick={() => handleRepeat(item)}
                    title="Cargar esta operación en la calculadora"
                    className="px-3 py-2 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <CornerUpLeft size={14} /> Cargar
                  </button>

                  <button
                    onClick={() => handleCopy(item.result, item.id)}
                    title="Copiar resultado"
                    className="p-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors"
                  >
                    {copiedId === item.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>

                  <button
                    onClick={() => handleDeleteOne(item.id)}
                    title="Eliminar registro"
                    className="p-2 border border-zinc-800 bg-zinc-900 hover:bg-red-950/40 hover:border-red-900/50 text-zinc-400 hover:text-red-400 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}