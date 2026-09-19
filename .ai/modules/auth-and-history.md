# Auth y Historial

## Propósito

Gestionar identidad del usuario (registro, confirmación, login, perfil) y la persistencia del
historial de cálculos, con dos backends: Supabase (autenticado) y `localStorage` (invitado).

## Responsabilidades

- Registro con nombre completo y confirmación por correo (enlace u OTP).
- Login por email/contraseña; redirección a verificación si el correo no está confirmado.
- Callback de Supabase para intercambiar el código por sesión.
- Actualizar `full_name` y contraseña desde el modal de perfil.
- Leer/escribir/borrar historial por módulo+subtema.
- Mostrar el historial global con búsqueda, filtro por subtema, repetir y borrar.

## Archivos principales

| Archivo | Rol |
|---|---|
| `app/(auth)/registro/page.tsx` | `signUp` con `emailRedirectTo=/auth/callback` |
| `app/(auth)/login/page.tsx` | `signInWithPassword`; detecta "Email not confirmed" |
| `app/(auth)/verificar/page.tsx` | `verifyOtp({type:"signup"})`, `resend`, escucha `onAuthStateChange` |
| `app/auth/callback/route.ts` | Route Handler: `exchangeCodeForSession` → `?next` o `/login?error=verification-failed` |
| `components/profile/profile-modal.tsx` | `updateUser` (nombre y contraseña) |
| `app/historial/page.tsx` | Historial global (`select *`, borrar uno/todo, repetir) |
| `lib/supabase/client.ts` | `createClient()` → `createBrowserClient` |
| `lib/supabase/history.ts` | `fetchUserHistory`, `saveUserCalculation`, `deleteUserHistory` |

## Dependencias

- `@supabase/ssr`, `@supabase/supabase-js`, `next/navigation`, `next/headers` (solo callback).
- `lucide-react` para iconos.
- `localStorage` del navegador (invitado).

## Dependencias internas

- Las 20 vistas de módulos usan `lib/supabase/history.ts`.
- El dashboard y `/historial` usan `lib/supabase/client.ts` directamente para auth y para
  operaciones globales.
- Las 4 vistas financieras usan `createClient()` para leer el nombre del usuario en el reporte.

## Flujo

```
REGISTRO
  /registro → signUp({ email, password, data:{full_name}, emailRedirectTo })
    → /verificar?email=…
        ├─ Método 1: clic en el correo → /auth/callback?code=… → exchangeCodeForSession
        │            → redirect a /dashboard (o ?next)
        └─ Método 2: OTP de 6 dígitos → verifyOtp({type:"signup"}) → /dashboard

LOGIN
  /login → signInWithPassword
    ├─ error "Email not confirmed" → /verificar?email=…
    ├─ otro error → mensaje en pantalla
    └─ ok → /dashboard (+ router.refresh())

SESIÓN EN EL DASHBOARD
  useEffect: supabase.auth.getUser() → setUser
              supabase.auth.onAuthStateChange → setUser(session?.user ?? null)
  logout: supabase.auth.signOut() → setUser(null) → router.refresh()

HISTORIAL DEL MÓDULO
  montaje de la vista → fetchUserHistory("matN","subtema") → setHistory
  botón Guardar → saveUserCalculation(...) → fetchUserHistory(...) → setHistory
  botón Vaciar → deleteUserHistory("subtema") → setHistory([])
      (history.ts decide Supabase si hay usuario; si no, localStorage
       con clave resolve_history_<subtema>, máximo 20 entradas)

HISTORIAL GLOBAL (/historial)
  getUser → si hay usuario: select * FROM user_history ORDER BY created_at DESC
          → si es invitado: lee SOLO "resolve_history_aritmetica"
  borrar uno → delete().eq("id", id)
  vaciar todo → delete().neq("id", "00000000-0000-0000-0000-000000000000")
  repetir → router.push("/dashboard?expr=<expression>")
```

## Puntos de entrada

- Rutas: `/registro`, `/login`, `/verificar`, `/historial`, `GET /auth/callback`.
- Funciones: `createClient()`, `fetchUserHistory`, `saveUserCalculation`, `deleteUserHistory`.
- Auth API usada: `signUp`, `signInWithPassword`, `verifyOtp`, `resend`, `signOut`, `getUser`,
  `onAuthStateChange`, `updateUser`, `exchangeCodeForSession`.

## Estado

**Activo**. Sin migración de historial invitado → cuenta.

## Riesgos o consideraciones

- **Sin `middleware.ts`**: no hay protección de rutas ni refresco de sesión en servidor; la
  seguridad del historial depende de las políticas RLS de `user_history` (no versionadas).
- `/historial` ejecuta `select *` sin filtrar por `user_id`: si RLS está mal configurado, se
  expondrían registros de otros usuarios.
- `deleteUserHistory(subtopic)` no filtra por `module`.
- El invitado en `/historial` solo ve aritmética (clave hardcodeada `resolve_history_aritmetica`).
- Nombres de tabla/columnas inferidos del uso: **No determinado** el esquema oficial ni las RLS.
- `onAuthStateChange` en `/verificar` ignora el parámetro `event` de la suscripción.
- No hay manejo de tokens expirados ni refresh explícito en el cliente.
- No hay recuperación de contraseña ("olvidé mi contraseña") implementada.

## Archivos relacionados

- `.ai/DATA_FLOW.md` (almacenamiento), `.ai/DECISIONS.md` (D5, D6, R5, R6, R9)
- `lib/supabase/*`, `app/(auth)/*`, `app/auth/callback/route.ts`, `app/historial/page.tsx`,
  `components/profile/profile-modal.tsx`