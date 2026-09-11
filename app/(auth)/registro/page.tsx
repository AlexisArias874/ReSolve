"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Redirigir a verificar con el correo como parámetro
    router.push(`/verificar?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Fondo sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_90%)]" />

      <div className="relative z-10 w-full max-w-md border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
        
        {/* Logo ReSolve */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shadow-sm">
            <Calculator className="text-zinc-950" size={20} />
          </div>
          <span className="text-2xl font-bold font-serif tracking-wide text-zinc-100">
            Re<span className="text-zinc-500">Solve</span>
          </span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Crear una cuenta</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Guarda tu historial de cálculo y sincronízalo en todos tus dispositivos.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alexis Martínez"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-sans"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
              Correo Institucional o Personal
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@universidad.edu"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-sans"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 py-3 rounded-xl font-medium text-sm transition-all shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Registrarme <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-800/60 text-center text-xs text-zinc-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-zinc-200 hover:underline font-medium">
            Inicia Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}