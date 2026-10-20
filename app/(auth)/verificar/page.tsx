"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MailCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CodeSlots, { type CodeSlotsStatus } from "@/components/effects/code-slots";
import BorderGlow from "@/components/effects/border-glow";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeSlotsStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const verifyingRef = useRef(false);

  // Escucha activa: si el usuario hace clic en el enlace en su correo, se redirige solo
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const verifyCode = async (raw: string) => {
    const token = raw.replace(/\D/g, "").slice(0, 6);
    if (token.length !== 6 || !emailParam || verifyingRef.current) return;

    verifyingRef.current = true;
    setError(null);
    setStatus("idle");
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: emailParam,
      token,
      type: "signup",
    });

    setLoading(false);

    if (verifyError) {
      verifyingRef.current = false;
      setError(verifyError.message);
      setStatus("error");
      return;
    }

    setStatus("success");
    // Deja ver la confirmación del componente antes de entrar al panel.
    window.setTimeout(() => router.push("/dashboard"), 650);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyCode(code);
  };

  const handleResend = async () => {
    if (!emailParam) return;
    setResending(true);
    setError(null);
    setStatus("idle");
    setResendSuccess(false);

    const supabase = createClient();
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: emailParam,
    });

    setResending(false);

    if (resendErr) {
      setError(resendErr.message);
    } else {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    }
  };

  return (
    <BorderGlow
      edgeSensitivity={30}
      glowColor="40 80 80"
      backgroundColor="#120F17"
      borderRadius={28}
      glowRadius={40}
      glowIntensity={1}
      coneSpread={25}
      animated={false}
      colors={["#c084fc", "#f472b6", "#38bdf8"]}
      className="w-full max-w-md"
    >
      <div className="w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-emerald-400">
          <MailCheck size={28} />
        </div>

        <h2 className="text-xl font-bold font-serif text-zinc-100 mb-1">Verifica tu cuenta</h2>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Enviamos un código de 6 dígitos y un enlace de confirmación a: <br />
          <strong className="text-zinc-200 font-mono text-sm">{emailParam || "tu correo"}</strong>
        </p>

        {/* Aviso del Link */}
        <div className="mb-6 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-left flex items-start gap-3">
          <ExternalLink size={16} className="text-zinc-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <strong>Método 1:</strong> Abre tu correo y haz clic directamente en el enlace de confirmación. Esta pantalla entrará sola al detectarlo.
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center gap-2 text-xs text-red-300 text-left">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-300 text-left">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            <span>Nuevo correo de confirmación enviado.</span>
          </div>
        )}

        {/* Formulario de Código OTP (Método 2) */}
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-3 text-left">
              Método 2: Ingresar código recibido
            </label>
            <div className="flex justify-center">
              <CodeSlots
                length={6}
                value={code}
                status={status}
                onChange={(next) => {
                  setCode(next);
                  setStatus("idle");
                }}
                onComplete={(next) => void verifyCode(next)}
                accentColor="#f5f5f5"
                inkColor="#f5f5f5"
                slotColor="#27272a"
                digitColor="#18181b"
                dangerColor="#ff3b30"
                slotSize={44}
                gap={8}
                radius={12}
                bounce={0.2}
                settle={0.3}
                rise={8}
                cascade={20}
                disabled={loading}
                ariaLabel="Código de verificación de 6 dígitos"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-300 text-zinc-950 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>Confirmar con Código <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span>¿No lo recibiste?</span>
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-zinc-200 hover:underline font-medium disabled:opacity-50"
          >
            {resending ? "Reenviando..." : "Reenviar correo"}
          </button>
        </div>
      </div>
    </BorderGlow>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 select-none relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_90%)]" />
      <div className="relative z-10">
        <Suspense fallback={<div className="text-zinc-500 text-xs">Cargando verificación...</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}