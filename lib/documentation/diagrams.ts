// =============================================================================
// ReSolve · Documentación interactiva — Fuente única de los diagramas
// -----------------------------------------------------------------------------
// Cada diagrama se declara de forma semántica (nodos/relaciones/tareas/mindmap)
// y los visores (React Flow, Gantt, mapa mental) se encargan del layout y la
// interactividad. Mantener aquí los datos evita duplicar diagramas por pantalla.
// =============================================================================

export type Tone =
  | "actor"
  | "start"
  | "end"
  | "process"
  | "decision"
  | "data"
  | "note";

export type DiagramKind = "flow" | "er" | "mindmap" | "gantt";

export type DiagramCategory =
  | "Organización"
  | "Planificación"
  | "Arquitectura"
  | "Base de datos"
  | "UML"
  | "Calidad";

export interface DocNode {
  id: string;
  label: string;
  sub?: string;
  tone?: Tone;
  width?: number;
  height?: number;
}

export interface DocEdge {
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
  animated?: boolean;
}

export interface ErField {
  name: string;
  type?: string;
  key?: "PK" | "FK" | "UK";
}

export interface ErEntity {
  id: string;
  name: string;
  tone?: Tone;
  fields: ErField[];
}

export interface ErRelation {
  source: string;
  target: string;
  label: string;
  sourceCard?: string;
  targetCard?: string;
}

export interface MindBranch {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

export interface GanttTask {
  id: string;
  name: string;
  section: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress?: number; // 0..100
  /** Detalle opcional visible en el calendario (horario, sede, etc.). */
  detail?: string;
}

export interface DiagramDef {
  id: string;
  title: string;
  category: DiagramCategory;
  description: string;
  kind: DiagramKind;
  direction?: "TB" | "LR";
  nodes?: DocNode[];
  edges?: DocEdge[];
  entities?: ErEntity[];
  relations?: ErRelation[];
  mindRoot?: { id: string; label: string };
  mindBranches?: MindBranch[];
  tasks?: GanttTask[];
}

// -----------------------------------------------------------------------------
// 1. Organigrama del equipo
// -----------------------------------------------------------------------------
const organigrama: DiagramDef = {
  id: "organigrama",
  title: "Organigrama del Equipo 1",
  category: "Organización",
  description:
    "Estructura plana con liderazgo de proyecto: un representante coordina nueve roles principales con sus apoyos.",
  kind: "flow",
  direction: "TB",
  nodes: [
    {
      id: "lider",
      label: "Ficher Navarro Ethan Axel",
      sub: "Representante · Líder de Proyecto · Arquitecto",
      tone: "actor",
      width: 250,
      height: 64,
    },
    { id: "gallardo", label: "Gallardo Nava Rodrigo", sub: "Analista Funcional", tone: "process" },
    { id: "corona", label: "Corona Díaz Luis Enrique", sub: "Administrador de BD (DBA)", tone: "data" },
    { id: "huerta", label: "Huerta Zarate Ernesto", sub: "Desarrollo Backend", tone: "process" },
    { id: "santiago", label: "Santiago Vázquez Leonel", sub: "Frontend / UX", tone: "process" },
    { id: "perez", label: "Perez Torres Juan Enrique", sub: "Calidad (QA) / UML", tone: "decision" },
    { id: "martinez", label: "Martinez Nery Diego Alejandro", sub: "Integración de IA", tone: "note" },
    { id: "palma", label: "Palma Lascano Jesús Alejandro", sub: "Documentación / Manuales", tone: "process" },
    { id: "acevedo", label: "Acevedo Esparza Diego Eduardo", sub: "DevOps / Seguridad", tone: "process" },
    { id: "pena", label: "Peña Arias Josue Alexis", sub: "Procesos / Capacitación", tone: "process" },
  ],
  edges: [
    { source: "lider", target: "gallardo" },
    { source: "lider", target: "corona" },
    { source: "lider", target: "huerta" },
    { source: "lider", target: "santiago" },
    { source: "lider", target: "perez" },
    { source: "lider", target: "martinez" },
    { source: "lider", target: "palma" },
    { source: "lider", target: "acevedo" },
    { source: "lider", target: "pena" },
  ],
};

// -----------------------------------------------------------------------------
// 2. Cronograma de actividades
// -----------------------------------------------------------------------------
const cronograma: DiagramDef = {
  id: "cronograma",
  title: "Cronograma de Actividades",
  category: "Planificación",
  description:
    "Plan de 10 semanas (agosto–octubre 2026) con las fases de inicio, análisis, diseño, desarrollo, pruebas y cierre.",
  kind: "gantt",
  tasks: [
    { id: "t1", name: "Formación del equipo y roles", section: "Inicio", start: "2026-08-18", end: "2026-08-22", progress: 100 },
    { id: "t2", name: "Charter y carta de inicio", section: "Inicio", start: "2026-08-24", end: "2026-08-28", progress: 100 },
    { id: "t3", name: "Análisis y descripción del problema", section: "Análisis", start: "2026-08-28", end: "2026-09-02", progress: 100 },
    { id: "t4", name: "Propuesta de solución y alcance", section: "Análisis", start: "2026-09-03", end: "2026-09-06", progress: 100 },
    { id: "t5", name: "Modelo E-R y modelo relacional", section: "Diseño", start: "2026-09-07", end: "2026-09-12", progress: 100 },
    { id: "t6", name: "Modelo físico, diccionario y SQL", section: "Diseño", start: "2026-09-14", end: "2026-09-18", progress: 100 },
    { id: "t7", name: "UML: casos de uso y actividades", section: "Diseño", start: "2026-09-21", end: "2026-09-25", progress: 100 },
    { id: "t8", name: "Diagrama de Ishikawa", section: "Diseño", start: "2026-09-24", end: "2026-09-26", progress: 100 },
    { id: "t9", name: "Frontend (dashboard y módulos)", section: "Desarrollo", start: "2026-09-28", end: "2026-10-05", progress: 95 },
    { id: "t10", name: "Backend, persistencia e IA", section: "Desarrollo", start: "2026-09-28", end: "2026-10-05", progress: 95 },
    { id: "t11", name: "Pruebas de calidad y correcciones", section: "Pruebas", start: "2026-10-06", end: "2026-10-10", progress: 100 },
    { id: "t12", name: "Configuración y despliegue", section: "Despliegue", start: "2026-10-12", end: "2026-10-14", progress: 80 },
    { id: "t13", name: "Manuales y capacitación", section: "Despliegue", start: "2026-10-13", end: "2026-10-15", progress: 70 },
    { id: "t14", name: "Cierre y entrega final", section: "Cierre", start: "2026-10-17", end: "2026-10-18", progress: 40 },
  ],
};

// -----------------------------------------------------------------------------
// 3. Arquitectura general del sistema
// -----------------------------------------------------------------------------
const arquitectura: DiagramDef = {
  id: "arquitectura",
  title: "Arquitectura del Sistema",
  category: "Arquitectura",
  description:
    "Aplicación web cliente-servidor sobre Next.js: el navegador ejecuta la interfaz y el motor; el servidor media con Supabase y el servicio de IA.",
  kind: "flow",
  direction: "LR",
  nodes: [
    { id: "user", label: "Usuario / Navegador", tone: "start", width: 180, height: 54 },
    { id: "app", label: "Aplicación Next.js", sub: "Frontend + API Routes", tone: "process", width: 210, height: 62 },
    { id: "db", label: "PostgreSQL", sub: "Supabase", tone: "data", width: 180, height: 62 },
    { id: "auth", label: "Supabase Auth", sub: "Correo y contraseña", tone: "data", width: 180, height: 62 },
    { id: "ia", label: "Servicio de IA (Groq)", sub: "Clasificación y respaldo", tone: "note", width: 200, height: 62 },
  ],
  edges: [
    { source: "user", target: "app", label: "HTTPS" },
    { source: "app", target: "db", label: "Cliente JS" },
    { source: "app", target: "auth", label: "Auth" },
    { source: "app", target: "ia", label: "HTTPS / JSON" },
    { source: "db", target: "auth", dashed: true },
  ],
};

// -----------------------------------------------------------------------------
// 4. Modelo Entidad-Relación
// -----------------------------------------------------------------------------
const entidadRelacion: DiagramDef = {
  id: "modelo-er",
  title: "Modelo Entidad-Relación",
  category: "Base de datos",
  description:
    "Modelo conceptual: un usuario (Supabase Auth) genera 1..N cálculos; cada cálculo pertenece a un solo usuario.",
  kind: "er",
  entities: [
    {
      id: "usuario",
      name: "USUARIO",
      tone: "data",
      fields: [
        { name: "id", type: "uuid", key: "PK" },
        { name: "email", type: "text", key: "UK" },
        { name: "encrypted_password", type: "text" },
        { name: "email_confirmed_at", type: "timestamptz" },
        { name: "created_at", type: "timestamptz" },
      ],
    },
    {
      id: "calculo",
      name: "CALCULO (user_history)",
      tone: "process",
      fields: [
        { name: "id", type: "uuid", key: "PK" },
        { name: "user_id", type: "uuid", key: "FK" },
        { name: "module", type: "text" },
        { name: "subtopic", type: "text" },
        { name: "expression", type: "text" },
        { name: "result", type: "text" },
        { name: "created_at", type: "timestamptz" },
      ],
    },
  ],
  relations: [
    { source: "usuario", target: "calculo", label: "genera", sourceCard: "1", targetCard: "N" },
  ],
};

// -----------------------------------------------------------------------------
// 5. Casos de uso
// -----------------------------------------------------------------------------
const casosUso: DiagramDef = {
  id: "casos-uso",
  title: "Diagrama de Casos de Uso",
  category: "UML",
  description:
    "Actores (visitante, estudiante, docente, administrador) y el sistema de IA como actor secundario; incluye y extiende la resolución de ejercicios.",
  kind: "flow",
  direction: "LR",
  nodes: [
    { id: "visitante", label: "Visitante / Invitado", tone: "start", width: 170, height: 52 },
    { id: "estudiante", label: "Estudiante registrado", tone: "actor", width: 180, height: 52 },
    { id: "docente", label: "Docente", tone: "actor", width: 150, height: 52 },
    { id: "admin", label: "Administrador", tone: "actor", width: 160, height: 52 },
    { id: "ia", label: "Sistema de IA (Groq)", tone: "note", width: 180, height: 52 },
    { id: "uc1", label: "Registrarse", tone: "process" },
    { id: "uc2", label: "Iniciar sesión", tone: "process" },
    { id: "uc3", label: "Verificar correo", tone: "process" },
    { id: "uc4", label: "Resolver ejercicio", tone: "decision" },
    { id: "uc5", label: "Ver Paso a Paso", tone: "process" },
    { id: "uc6", label: "Consultar Teoría", tone: "process" },
    { id: "uc7", label: "Usar Calculadora Universal", tone: "decision" },
    { id: "uc8", label: "Consultar historial", tone: "process" },
    { id: "uc9", label: "Buscar / filtrar historial", tone: "process" },
    { id: "uc10", label: "Repetir / copiar cálculo", tone: "process" },
    { id: "uc11", label: "Eliminar / vaciar historial", tone: "process" },
    { id: "uc12", label: "Personalizar tema y animaciones", tone: "process" },
    { id: "uc13", label: "Gestionar usuarios / políticas", tone: "process" },
  ],
  edges: [
    { source: "visitante", target: "uc4" },
    { source: "visitante", target: "uc7" },
    { source: "visitante", target: "uc8" },
    { source: "visitante", target: "uc12" },
    { source: "estudiante", target: "uc1" },
    { source: "estudiante", target: "uc2" },
    { source: "estudiante", target: "uc3" },
    { source: "estudiante", target: "uc4" },
    { source: "estudiante", target: "uc5" },
    { source: "estudiante", target: "uc6" },
    { source: "estudiante", target: "uc7" },
    { source: "estudiante", target: "uc8" },
    { source: "estudiante", target: "uc9" },
    { source: "estudiante", target: "uc10" },
    { source: "estudiante", target: "uc11" },
    { source: "estudiante", target: "uc12" },
    { source: "docente", target: "uc5" },
    { source: "docente", target: "uc6" },
    { source: "admin", target: "uc13" },
    { source: "uc7", target: "ia", label: "«include»", dashed: true },
    { source: "uc4", target: "uc7", label: "«extend» (si falla el motor local)", dashed: true },
  ],
};

// -----------------------------------------------------------------------------
// 6. Actividad: registro, verificación e inicio de sesión
// -----------------------------------------------------------------------------
const actRegistro: DiagramDef = {
  id: "act-registro",
  title: "Actividad · Registro e Inicio de Sesión",
  category: "UML",
  description:
    "Flujo de alta de usuario: registro, envío y confirmación del correo, e inicio de sesión con validación de credenciales.",
  kind: "flow",
  direction: "TB",
  nodes: [
    { id: "s", label: "Inicio", tone: "start", width: 130, height: 46 },
    { id: "r", label: "Abrir formulario de registro", tone: "process" },
    { id: "d1", label: "Capturar correo y contraseña", tone: "process" },
    { id: "c1", label: "¿Datos válidos?", tone: "decision" },
    { id: "err", label: "Mostrar error", tone: "end" },
    { id: "crear", label: "Crear cuenta (Supabase Auth)", tone: "process" },
    { id: "mail", label: "Enviar correo de verificación", tone: "process" },
    { id: "v", label: "Usuario abre el enlace", tone: "process" },
    { id: "cb", label: "Confirmar cuenta (callback)", tone: "process" },
    { id: "log", label: "Iniciar sesión", tone: "process" },
    { id: "c2", label: "¿Credenciales correctas?", tone: "decision" },
    { id: "err2", label: "Mostrar error", tone: "end" },
    { id: "dash", label: "Acceder al panel principal", tone: "process" },
    { id: "f", label: "Fin", tone: "end", width: 130, height: 46 },
  ],
  edges: [
    { source: "s", target: "r" },
    { source: "r", target: "d1" },
    { source: "d1", target: "c1" },
    { source: "c1", target: "err", label: "No" },
    { source: "err", target: "r" },
    { source: "c1", target: "crear", label: "Sí" },
    { source: "crear", target: "mail" },
    { source: "mail", target: "v" },
    { source: "v", target: "cb" },
    { source: "cb", target: "log" },
    { source: "log", target: "c2" },
    { source: "c2", target: "err2", label: "No" },
    { source: "err2", target: "log" },
    { source: "c2", target: "dash", label: "Sí" },
    { source: "dash", target: "f" },
  ],
};

// -----------------------------------------------------------------------------
// 7. Actividad: resolver un ejercicio
// -----------------------------------------------------------------------------
const actResolver: DiagramDef = {
  id: "act-resolver",
  title: "Actividad · Resolver un Ejercicio",
  category: "UML",
  description:
    "El motor local resuelve lo reconocido; si falla, la Calculadora Universal consulta la IA y adapta el resultado al módulo destino.",
  kind: "flow",
  direction: "TB",
  nodes: [
    { id: "s", label: "Inicio", tone: "start", width: 130, height: 46 },
    { id: "in", label: "Ingresar expresión o enunciado", tone: "process" },
    { id: "norm", label: "Normalizar y adaptar expresión", tone: "process" },
    { id: "c1", label: "¿El motor local puede resolverlo?", tone: "decision", width: 220 },
    { id: "res", label: "Calcular resultado y pasos", tone: "process" },
    { id: "omni", label: "Calculadora Universal: consultar IA", tone: "note", width: 220 },
    { id: "json", label: "Recibir JSON estructurado", tone: "process" },
    { id: "adapt", label: "Adaptar y enrutar al módulo destino", tone: "process" },
    { id: "show", label: "Mostrar resultado y Paso a Paso", tone: "process" },
    { id: "save", label: "¿Usuario registrado?", tone: "decision" },
    { id: "db", label: "Guardar en la nube (Supabase)", tone: "data" },
    { id: "ls", label: "Guardar en el historial local", tone: "process" },
    { id: "f", label: "Fin", tone: "end", width: 130, height: 46 },
  ],
  edges: [
    { source: "s", target: "in" },
    { source: "in", target: "norm" },
    { source: "norm", target: "c1" },
    { source: "c1", target: "res", label: "Sí" },
    { source: "c1", target: "omni", label: "No" },
    { source: "omni", target: "json" },
    { source: "json", target: "adapt" },
    { source: "adapt", target: "res" },
    { source: "res", target: "show" },
    { source: "show", target: "save" },
    { source: "save", target: "db", label: "Sí" },
    { source: "save", target: "ls", label: "No" },
    { source: "db", target: "f" },
    { source: "ls", target: "f" },
  ],
};

// -----------------------------------------------------------------------------
// 8. Actividad: consultar y gestionar el historial
// -----------------------------------------------------------------------------
const actHistorial: DiagramDef = {
  id: "act-historial",
  title: "Actividad · Consultar el Historial",
  category: "UML",
  description:
    "Carga de registros desde la nube o local según la sesión, con acciones de buscar, repetir, copiar, eliminar y vaciar.",
  kind: "flow",
  direction: "TB",
  nodes: [
    { id: "s", label: "Inicio", tone: "start", width: 130, height: 46 },
    { id: "ab", label: "Abrir Historial", tone: "process" },
    { id: "c0", label: "¿Sesión iniciada?", tone: "decision" },
    { id: "load", label: "Cargar registros desde Supabase", tone: "data" },
    { id: "local", label: "Cargar registros locales", tone: "process" },
    { id: "list", label: "Mostrar listado", tone: "process" },
    { id: "acc", label: "¿Acción?", tone: "decision" },
    { id: "fil", label: "Aplicar filtros", tone: "process" },
    { id: "rep", label: "Cargar en la calculadora", tone: "process" },
    { id: "cop", label: "Copiar resultado al portapapeles", tone: "process" },
    { id: "del", label: "Eliminar registro", tone: "process" },
    { id: "clear", label: "Borrar todos los registros", tone: "process" },
    { id: "f", label: "Fin", tone: "end", width: 130, height: 46 },
  ],
  edges: [
    { source: "s", target: "ab" },
    { source: "ab", target: "c0" },
    { source: "c0", target: "load", label: "Sí" },
    { source: "c0", target: "local", label: "No" },
    { source: "load", target: "list" },
    { source: "local", target: "list" },
    { source: "list", target: "acc" },
    { source: "acc", target: "fil", label: "Buscar / filtrar" },
    { source: "fil", target: "list" },
    { source: "acc", target: "rep", label: "Repetir" },
    { source: "rep", target: "f" },
    { source: "acc", target: "cop", label: "Copiar" },
    { source: "cop", target: "list" },
    { source: "acc", target: "del", label: "Eliminar" },
    { source: "del", target: "list" },
    { source: "acc", target: "clear", label: "Vaciar todo" },
    { source: "clear", target: "f" },
  ],
};

// -----------------------------------------------------------------------------
// 9. Ishikawa (causa-efecto)
// -----------------------------------------------------------------------------
const ishikawa: DiagramDef = {
  id: "ishikawa",
  title: "Diagrama de Ishikawa (Causa-Efecto)",
  category: "Calidad",
  description:
    "Análisis de las causas de la dificultad para resolver y comprender ejercicios, agrupadas en seis dimensiones. Explora y colapsa cada rama.",
  kind: "mindmap",
  mindRoot: { id: "root", label: "Dificultad para resolver y comprender ejercicios" },
  mindBranches: [
    {
      id: "metodos",
      label: "Métodos",
      children: [
        { id: "m1", label: "Falta de procedimiento paso a paso" },
        { id: "m2", label: "Estudio memorístico sin comprensión" },
        { id: "m3", label: "Ausencia de verificación de resultados" },
      ],
    },
    {
      id: "medicion",
      label: "Medición",
      children: [
        { id: "med1", label: "No se registra el avance del alumno" },
        { id: "med2", label: "Sin control de errores recurrentes" },
      ],
    },
    {
      id: "personas",
      label: "Personas",
      children: [
        { id: "p1", label: "Baja cultura de consulta de teoría" },
        { id: "p2", label: "Poca retroalimentación oportuna" },
        { id: "p3", label: "Sobrecarga de grupos numerosos" },
      ],
    },
    {
      id: "entorno",
      label: "Entorno",
      children: [
        { id: "e1", label: "Herramientas dispersas por área" },
        { id: "e2", label: "Dependencia de soluciones aisladas en internet" },
        { id: "e3", label: "Acceso variable a recursos" },
      ],
    },
    {
      id: "materiales",
      label: "Materiales",
      children: [
        { id: "mat1", label: "Apuntes desordenados y no centralizados" },
        { id: "mat2", label: "Teoría no vinculada al ejercicio" },
      ],
    },
    {
      id: "tecnologia",
      label: "Tecnología",
      children: [
        { id: "t1", label: "Apps que solo dan el resultado" },
        { id: "t2", label: "Falta de historial reutilizable" },
        { id: "t3", label: "Notaciones distintas por materia" },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// 10. Calendario de capacitación
// -----------------------------------------------------------------------------
const capacitacion: DiagramDef = {
  id: "capacitacion",
  title: "Calendario de Capacitación",
  category: "Planificación",
  description:
    "Cinco sesiones para estudiantes y personal de soporte, sobre el uso y la administración de la plataforma. Vista de calendario con horario y detalle por día.",
  kind: "gantt",
  tasks: [
    { id: "s1", name: "Sesión 1 · Introducción y navegación", section: "Estudiantes", start: "2026-10-19", end: "2026-10-19", detail: "16:00 – 18:00" },
    { id: "s2", name: "Sesión 2 · Módulos y vistas", section: "Estudiantes", start: "2026-10-20", end: "2026-10-20", detail: "16:00 – 18:00" },
    { id: "s3", name: "Sesión 3 · Calculadora Universal (IA)", section: "Estudiantes", start: "2026-10-21", end: "2026-10-21", detail: "16:00 – 18:00" },
    { id: "s4", name: "Sesión 4 · Historial", section: "Estudiantes", start: "2026-10-22", end: "2026-10-22", detail: "16:00 – 18:00" },
    { id: "s5", name: "Sesión 5 · Administración y soporte", section: "Soporte", start: "2026-10-23", end: "2026-10-23", detail: "10:00 – 12:00" },
  ],
};

// -----------------------------------------------------------------------------
// Catálogo
// -----------------------------------------------------------------------------
export const DIAGRAMS: DiagramDef[] = [
  organigrama,
  cronograma,
  arquitectura,
  entidadRelacion,
  casosUso,
  actRegistro,
  actResolver,
  actHistorial,
  ishikawa,
  capacitacion,
];

export const CATEGORIES: DiagramCategory[] = [
  "Organización",
  "Planificación",
  "Arquitectura",
  "Base de datos",
  "UML",
  "Calidad",
];
