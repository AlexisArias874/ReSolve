import type { ManualDefinition } from "./types";

export const TECHNICAL_MANUAL: ManualDefinition = {
  id: "tecnico",
  title: "Manual Técnico",
  shortTitle: "Técnico",
  audience: "Equipo de desarrollo, base de datos y soporte técnico",
  description:
    "Documenta la arquitectura, el modelo de datos, los diagramas UML y las piezas de código que sostienen ReSolve.",
  version: "1.0",
  updatedAt: "Octubre 2026",
  sections: [
    {
      id: "presentacion",
      title: "1. Presentación y alcance",
      blocks: [
        {
          type: "paragraph",
          text: "Este manual describe la estructura técnica de ReSolve, una plataforma web para resolver ejercicios de matemáticas universitarias. Está dirigido al equipo de desarrollo, al administrador de la base de datos y al personal de soporte que necesite comprender cómo están organizados los componentes del sistema.",
        },
        {
          type: "paragraph",
          text: "El documento se concentra en la arquitectura, el modelo de datos, los diagramas UML y las piezas de código relevantes. No sustituye a la documentación interactiva de diagramas, sino que la complementa con una explicación ordenada para la entrega académica.",
        },
        {
          type: "list",
          items: [
            "Arquitectura general y capas del sistema.",
            "Modelo conceptual, lógico y físico de la base de datos.",
            "Casos de uso, actividades e Ishikawa.",
            "Funciones, procedimientos, scripts y consultas representativas.",
          ],
        },
        {
          type: "callout",
          title: "Créditos",
          text: "Documento elaborado por el Equipo 2 de la Licenciatura en Informática de la FESC.",
          tone: "note",
        },
      ],
    },
    {
      id: "arquitectura",
      title: "2. Arquitectura del sistema",
      blocks: [
        {
          type: "paragraph",
          text: "ReSolve es una aplicación web cliente-servidor construida con Next.js, React y TypeScript. El navegador ejecuta la interfaz y el motor matemático local; el servidor expone rutas de API que actúan como intermediarias con Supabase y con el servicio de inteligencia artificial.",
        },
        {
          type: "table",
          headers: ["Capa", "Tecnología", "Responsabilidad"],
          rows: [
            ["Presentación", "React, Next.js y Tailwind CSS", "Interfaz, temas, navegación y animaciones."],
            ["Lógica de negocio", "TypeScript", "Motor matemático, clasificación y adaptadores."],
            ["API", "Route Handlers de Next.js", "Puente seguro hacia el servicio de IA."],
            ["Persistencia", "Supabase / PostgreSQL", "Historial de cálculos y datos del usuario."],
            ["Autenticación", "Supabase Auth", "Registro, sesión y verificación por correo."],
            ["Inteligencia artificial", "Groq", "Clasificación y resolución en lenguaje natural."],
          ],
        },
        {
          type: "diagram",
          diagramId: "arquitectura",
          caption: "Arquitectura general: navegador, aplicación, base de datos y servicio de IA.",
        },
        {
          type: "paragraph",
          text: "La comunicación con los servicios externos se realiza mediante HTTPS. Las credenciales sensibles permanecen en variables de entorno del servidor y nunca se incluyen en el código del navegador.",
        },
      ],
    },
    {
      id: "base-datos",
      title: "3. Base de datos",
      blocks: [
        {
          type: "paragraph",
          text: "La base de datos se organiza alrededor de dos entidades principales: el usuario, administrado por Supabase Auth, y el cálculo, almacenado en la tabla user_history. Un usuario puede generar muchos cálculos y cada cálculo pertenece a un solo usuario.",
        },
        {
          type: "diagram",
          diagramId: "modelo-er",
          caption: "Modelo entidad-relación del historial de cálculos.",
        },
        {
          type: "paragraph",
          text: "El modelo conceptual identifica al usuario por su identificador, correo y estado de verificación. El cálculo registra el módulo, el subtema, la expresión de entrada, el resultado y la fecha de creación.",
        },
        {
          type: "table",
          headers: ["Tabla", "Atributo", "Tipo", "Restricción"],
          rows: [
            ["auth.users", "id", "UUID", "Clave primaria"],
            ["auth.users", "email", "TEXT", "Único, obligatorio"],
            ["auth.users", "encrypted_password", "TEXT", "Obligatorio"],
            ["auth.users", "email_confirmed_at", "TIMESTAMPTZ", "Puede ser nulo"],
            ["user_history", "id", "UUID", "Clave primaria"],
            ["user_history", "user_id", "UUID", "Clave foránea a auth.users"],
            ["user_history", "module", "TEXT", "Obligatorio"],
            ["user_history", "subtopic", "TEXT", "Obligatorio"],
            ["user_history", "expression", "TEXT", "Obligatorio"],
            ["user_history", "result", "TEXT", "Obligatorio"],
            ["user_history", "created_at", "TIMESTAMPTZ", "Valor automático"],
          ],
          caption: "Modelo lógico: tablas y atributos principales.",
        },
        {
          type: "table",
          headers: ["Campo", "Descripción", "Ejemplo"],
          rows: [
            ["id", "Identificador único del cálculo.", "a1b2c3d4-..."],
            ["user_id", "Usuario propietario del registro.", "f9e8d7c6-..."],
            ["module", "Módulo de origen.", "mat4"],
            ["subtopic", "Subtema trabajado.", "matrices"],
            ["expression", "Expresión o enunciado de entrada.", "x + y = 5"],
            ["result", "Resultado o solución.", "x = 3, y = 2"],
            ["created_at", "Fecha y hora del cálculo.", "2026-10-01 12:30"],
          ],
          caption: "Diccionario de datos de user_history.",
        },
        {
          type: "code",
          title: "Script de creación y seguridad de la tabla",
          language: "sql",
          code: `create table if not exists public.user_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  module      text not null,
  subtopic    text not null,
  expression  text not null,
  result      text not null,
  created_at  timestamptz not null default now()
);

alter table public.user_history enable row level security;

create policy "select_own_history"
  on public.user_history for select
  using (auth.uid() = user_id);

create policy "insert_own_history"
  on public.user_history for insert
  with check (auth.uid() = user_id);

create policy "delete_own_history"
  on public.user_history for delete
  using (auth.uid() = user_id);`,
          note: "El historial es inmutable: no se habilita la operación UPDATE.",
        },
      ],
    },
    {
      id: "uml",
      title: "4. Diagramas UML",
      blocks: [
        {
          type: "paragraph",
          text: "Los diagramas UML permiten leer el sistema desde los actores, los flujos de registro, resolución e historial, y las causas de fallo. Se mantienen como diagramas interactivos en la sección de documentación.",
        },
        {
          type: "diagram",
          diagramId: "casos-uso",
          caption: "Casos de uso principales y actores del sistema.",
        },
        {
          type: "table",
          headers: ["Actor", "Tipo", "Alcance"],
          rows: [
            ["Visitante", "Primario", "Resolver ejercicios y usar el historial local."],
            ["Estudiante", "Primario", "Cuenta registrada con historial en la nube."],
            ["Docente", "Primario", "Usuario registrado normal, sin privilegios administrativos."],
            ["Administrador", "Primario", "Gestión de usuarios y políticas desde Supabase."],
            ["Sistema de IA", "Secundario", "Clasificación y apoyo en la Calculadora Universal."],
          ],
        },
        {
          type: "diagram",
          diagramId: "act-registro",
          caption: "Actividad de registro y verificación de cuenta.",
        },
        {
          type: "diagram",
          diagramId: "act-resolver",
          caption: "Actividad de resolución de un ejercicio.",
        },
        {
          type: "diagram",
          diagramId: "act-historial",
          caption: "Actividad de consulta y gestión del historial.",
        },
        {
          type: "diagram",
          diagramId: "ishikawa",
          caption: "Diagrama de Ishikawa: causas de errores en el uso de la plataforma.",
        },
        {
          type: "paragraph",
          text: "En los diagramas de actividades se distinguen las rutas del invitado y del usuario registrado. La diferencia principal es el destino del historial: almacenamiento local o base de datos en la nube.",
        },
      ],
    },
    {
      id: "codigo",
      title: "5. Código",
      blocks: [
        {
          type: "paragraph",
          text: "Se documentan las piezas de código más representativas. El código completo permanece en el repositorio y este manual solo muestra los fragmentos necesarios para comprender el flujo.",
        },
        {
          type: "code",
          title: "Función: cliente de Supabase en el navegador",
          language: "ts",
          code: `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}`,
        },
        {
          type: "code",
          title: "Función: guardar un cálculo",
          language: "ts",
          code: `export async function saveUserCalculation(
  module: string,
  subtopic: string,
  expression: string,
  result: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // El invitado conserva su historial en localStorage.
    saveLocalHistory(subtopic, expression, result);
    return;
  }

  await supabase.from("user_history").insert({
    user_id: user.id,
    module,
    subtopic,
    expression,
    result,
  });
}`,
          note: "El historial local y el de la nube comparten la misma estructura de presentación.",
        },
        {
          type: "table",
          headers: ["Procedimiento", "Ubicación", "Función"],
          rows: [
            ["Callback de autenticación", "app/auth/callback/route.ts", "Intercambia el código de verificación por una sesión."],
            ["Motor universal", "app/api/ai/omni-solve/route.ts", "Clasifica un problema y devuelve un JSON estructurado."],
            ["Chat contextual", "app/api/ai/chat/route.ts", "Responde preguntas sobre el cálculo activo."],
            ["Persistencia", "lib/supabase/history.ts", "Guarda, consulta y elimina registros del historial."],
          ],
        },
        {
          type: "code",
          title: "Procedimiento: callback de autenticación",
          language: "ts",
          code: `export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(origin + next);
  }

  return NextResponse.redirect(origin + "/login?error=verification-failed");
}`,
        },
        {
          type: "code",
          title: "Script de puesta a punto del entorno",
          language: "bash",
          code: `git clone <url-del-repositorio>
cd plataforma-matematica
npm install
# Crear .env.local con las variables de Supabase y Groq
npm run dev
npm run lint
npm run build
npm run start`,
          note: "Las claves reales no se incluyen en el manual ni en el repositorio.",
        },
        {
          type: "code",
          title: "Consulta: últimos cálculos de un usuario",
          language: "sql",
          code: `select id, expression, result, created_at
from public.user_history
where user_id = auth.uid()
  and module = 'mat4'
  and subtopic = 'matrices'
order by created_at desc
limit 25;`,
        },
        {
          type: "code",
          title: "Consulta: conteo de cálculos por módulo",
          language: "sql",
          code: `select module,
       count(*) as total_calculos,
       count(distinct subtopic) as subtemas_distintos
from public.user_history
where user_id = auth.uid()
group by module
order by total_calculos desc;`,
        },
      ],
    },
    {
      id: "mantenimiento",
      title: "6. Seguridad y mantenimiento",
      blocks: [
        {
          type: "list",
          items: [
            "Mantener las políticas RLS activas en todas las tablas con datos de usuario.",
            "No exponer claves de servicio ni el secreto de IA en el cliente.",
            "Revisar periódicamente las dependencias y las migraciones de Supabase.",
            "Probar el registro, la verificación y el historial después de cada despliegue.",
            "Conservar respaldos de la base de datos antes de cambios estructurales.",
          ],
        },
        {
          type: "callout",
          title: "Criterio de aceptación",
          text: "Un cambio técnico se considera terminado cuando compila, pasa las pruebas, mantiene las políticas de acceso y no rompe los flujos de invitado, estudiante o administrador.",
          tone: "important",
        },
      ],
    },
  ],
};
