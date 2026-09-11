"use client";

import { useState } from "react";
import { User, Lock, Mail, Check, AlertCircle, Loader2, X, Shield, Calendar } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  onProfileUpdated: () => void;
}

export default function ProfileModal({ isOpen, onClose, user, onProfileUpdated }: ProfileModalProps) {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (!isOpen || !user) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })
    : "Reciente";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-lg border border-zinc-800 bg-zinc-950 rounded-2xl p-6 shadow-2xl overflow-hidden">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Ajustes de Perfil</h3>
              <p className="text-xs text-zinc-400">Gestiona tus datos personales y credenciales de acceso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensajes de Estado */}
        {message && (
          <div
            className={`my-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-300"
                : "bg-red-950/20 border-red-900/50 text-red-300"
            }`}
          >
            {message.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto pr-1">
          
          {/* Ficha Informativa del Usuario */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-2 text-xs">
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

          {/* Formulario 1: Modificar Nombre */}
          <form onSubmit={handleUpdateName} className="space-y-3">
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
                className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
              <button
                type="submit"
                disabled={loadingName}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
              >
                {loadingName ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
              </button>
            </div>
          </form>

          {/* Formulario 2: Modificar Contraseña */}
          <form onSubmit={handleUpdatePassword} className="space-y-3 pt-4 border-t border-zinc-800/60">
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
                placeholder="Nueva contraseña (mínimo 6 caracteres)"
                className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
              <button
                type="submit"
                disabled={loadingPass || !newPassword}
                className="px-4 py-2.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shrink-0"
              >
                {loadingPass ? <Loader2 size={14} className="animate-spin" /> : "Cambiar"}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}