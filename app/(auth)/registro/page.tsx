"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/auth-shell";

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
    const { data, error: signUpError } = await supabase.auth.signUp({
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

    // Si la confirmación por correo está desactivada en Supabase, signUp ya
    // devuelve una sesión válida: no tiene sentido pedir un código que nunca
    // se envió. Entramos directamente al panel.
    if (data.session) {
      router.push("/dashboard");
      return;
    }

    // Supabase devuelve un usuario sin identidades cuando el correo ya existe
    // (por seguridad no lanza error). Evita mandar a una pantalla de espera.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError("Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.");
      return;
    }

    // Redirigir a verificar con el correo como parámetro
    router.push(`/verificar?email=${encodeURIComponent(email)}`);
  };

  return (
    <AuthShell tagline="Resuelve, comprende y guarda cada paso de tus cálculos.">
      <div className="relative w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Crear una cuenta</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Guarda tu historial de cálculo y sincronízalo en todos tus dispositivos.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alexis Martínez"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-sans text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">
              Correo Institucional o Personal
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-sans text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-sm font-medium text-zinc-950 shadow-md transition-all hover:bg-zinc-300 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Registrarme <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-800/60 pt-5 text-center text-xs text-zinc-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-zinc-200 hover:underline">
            Inicia Sesión
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}