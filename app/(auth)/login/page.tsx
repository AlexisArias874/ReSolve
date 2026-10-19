"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      if (signInError.message.includes("Email not confirmed")) {
        router.push(`/verificar?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <AuthShell tagline="Cálculo, álgebra y métodos numéricos con explicaciones paso a paso.">
      <div className="relative w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Iniciar Sesión</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Accede a tu historial de operaciones
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@universidad.edu"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-sans text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-sans text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-sm font-medium text-zinc-950 shadow-md transition-all hover:bg-zinc-300 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Ingresar <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-800/60 pt-5 text-center text-xs text-zinc-400">
          ¿No tienes una cuenta aún?{" "}
          <Link href="/registro" className="font-medium text-zinc-200 hover:underline">
            Regístrate aquí
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}