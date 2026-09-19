"use client";

import { useState, useEffect } from "react";
import {
  User,
  Lock,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  X,
  Shield,
  Calendar,
  Palette,
  Moon,
  Sun,
  BookOpen,
  Terminal
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  onProfileUpdated: () => void;
}

const THEMES = [
  {
    id: "dark",
    name: "Oscuro (Obsidian)",
    desc: "Predeterminado de ReSolve con fondo profundo y acentos ámbar.",
    icon: Moon,
    previewBg: "bg-[#09090b]",
    previewBorder: "border-zinc-700",
    previewText: "text-zinc-100",
  },
  {
    id: "light",
    name: "Claro (Editorial)",
    desc: "Papel blanco universitario con textos nítidos para luz de día.",
    icon: Sun,
    previewBg: "bg-white",
    previewBorder: "border-slate-300",
    previewText: "text-slate-900",
  },
  {
    id: "sepia",
    name: "Sepia (Lectura)",
    desc: "Tono pergamino cálido tipo Kindle para descansar la vista.",
    icon: BookOpen,
    previewBg: "bg-[#fbf0d9]",
    previewBorder: "border-[#dac29a]",
    previewText: "text-[#2b241c]",
  },
  {
    id: "matrix",
    name: "Matrix (Cyberpunk)",
    desc: "Terminal de ingeniería en negro puro y verde fósforo.",
    icon: Terminal,
    previewBg: "bg-[#020804]",
    previewBorder: "border-[#059669]",
    previewText: "text-[#34d399]",
  },
];

export default function ProfileModal({ isOpen, onClose, user, onProfileUpdated }: ProfileModalProps) {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [activeTheme, setActiveTheme] = useState("dark");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Leer tema inicial
  useEffect(() => {
    if (typeof window !== "undefined") {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      setActiveTheme(current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Cambiar tema y guardar en Supabase / LocalStorage
  const handleSelectTheme = async (themeId: string) => {
    setActiveTheme(themeId);
    document.documentElement.setAttribute("data-theme", themeId);
    localStorage.setItem("resolve_theme", themeId);

    // Disparar evento para que las gráficas Canvas cambien de color al instante
    window.dispatchEvent(new Event("themechange"));

    // Si está autenticado, guardar en su perfil de Supabase
    if (user) {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { theme: themeId },
      });
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoadingName(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });

    setLoadingName(false);

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Nombre actualizado con éxito.", type: "success" });
      onProfileUpdated();
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 6) {
      setMessage({ text: "La contraseña debe tener mínimo 6 caracteres.", type: "error" });
      return;
    }

    setLoadingPass(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoadingPass(false);

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Contraseña actualizada correctamente.", type: "success" });
      setNewPassword("");
    }
  };

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })
    : "Sesión activa";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-lg border border-zinc-800 bg-zinc-950 rounded-3xl p-6 lg:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100 font-serif">Ajustes y Perfil</h3>
              <p className="text-xs text-zinc-400">Personaliza la apariencia y gestiona tus credenciales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensajes de Estado */}
        {message && (
          <div
            className={`my-3 p-3 rounded-xl border text-xs flex items-center gap-2 shrink-0 ${
              message.type === "success"
                ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-300"
                : "bg-red-950/20 border-red-900/50 text-red-300"
            }`}
          >
            {message.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="space-y-6 mt-4 overflow-y-auto custom-scrollbar pr-1 flex-1">
          {/* SECCIÓN 1: SELECTOR VISUAL DE TEMAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Palette size={13} className="text-amber-400" /> Tema de la Plataforma
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Cambio instantáneo</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((thm) => {
                const Icon = thm.icon;
                const isSelected = activeTheme === thm.id;
                return (
                  <button
                    key={thm.id}
                    type="button"
                    onClick={() => handleSelectTheme(thm.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "border-amber-400 bg-zinc-900/90 shadow-md ring-1 ring-amber-400/30"
                        : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center ${thm.previewBg} ${thm.previewBorder}`}
                        >
                          <Icon size={12} className={thm.previewText} />
                        </div>
                        <span className="text-xs font-medium text-zinc-200">{thm.name}</span>
                      </div>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-tight">{thm.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL USUARIO */}
          {user ? (
            <>
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1.5 font-mono">
                    <Mail size={13} /> Correo Registrado
                  </span>
                  <span className="text-zinc-200 font-mono font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1.5 font-mono">
                    <Calendar size={13} /> Miembro desde
                  </span>
                  <span className="text-zinc-300">{createdAt}</span>
                </div>
              </div>

              {/* Modificar Nombre */}
              <form onSubmit={handleUpdateName} className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User size={13} /> Nombre Completo
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Alexis Martínez"
                    className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loadingName}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
                  >
                    {loadingName ? <Loader2 size={13} className="animate-spin" /> : "Guardar"}
                  </button>
                </div>
              </form>

              {/* Modificar Contraseña */}
              <form onSubmit={handleUpdatePassword} className="space-y-2 pt-2 border-t border-zinc-800/60">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Lock size={13} /> Actualizar Contraseña
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loadingPass || !newPassword}
                    className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
                  >
                    {loadingPass ? <Loader2 size={13} className="animate-spin" /> : "Cambiar"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-400 text-center">
              Estás en Modo Invitado. El tema se guardará en tu navegador local.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}