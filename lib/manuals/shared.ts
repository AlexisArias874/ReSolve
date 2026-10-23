// =============================================================================
// ReSolve · Datos compartidos por los manuales
// -----------------------------------------------------------------------------
// Zonas de interfaz, actores y capacitación. Se declaran una sola vez y los
// tres manuales consumen la misma información.
// =============================================================================

export interface UiZone {
  id: string;
  number: number;
  title: string;
  description: string;
  guest: string;
  student: string;
  teacher: string;
  admin: string;
}

export const UI_ZONES: UiZone[] = [
  {
    id: "sidebar",
    number: 1,
    title: "Menú lateral izquierdo",
    description:
      "Concentra el acceso a la Calculadora Universal, los seis módulos, los recursos y la configuración de tema.",
    guest: "Puede entrar a todos los módulos y recursos.",
    student: "Además, conserva el historial en la nube al iniciar sesión.",
    teacher: "Lo usa igual que un estudiante registrado.",
    admin: "Puede consultar la estructura y la documentación del sistema.",
  },
  {
    id: "header",
    number: 2,
    title: "Encabezado superior",
    description:
      "Muestra la ubicación del módulo, el subtema activo y los accesos a Calcular, Paso a Paso, Teoría, historial, enfoque e IA.",
    guest: "Puede cambiar de vista y abrir el asistente.",
    student: "Dispone de las mismas opciones, con historial persistente.",
    teacher: "No tiene opciones adicionales por su rol.",
    admin: "Puede usar el modo enfoque para revisar contenido.",
  },
  {
    id: "subtopics",
    number: 3,
    title: "Selector de subtemas",
    description:
      "Permite cambiar entre los temas de un módulo sin volver al menú principal.",
    guest: "Accede a todos los subtemas disponibles.",
    student: "Accede a todos los subtemas y conserva el contexto.",
    teacher: "Selecciona subtemas como cualquier usuario.",
    admin: "No modifica el catálogo desde la interfaz.",
  },
  {
    id: "workspace",
    number: 4,
    title: "Área de trabajo",
    description:
      "Contiene la entrada del ejercicio, el resultado, los pasos y la teoría del subtema seleccionado.",
    guest: "Puede resolver y consultar el procedimiento.",
    student: "Puede resolver y guardar el cálculo en su historial.",
    teacher: "Puede resolver y explicar el procedimiento.",
    admin: "Puede verificar el comportamiento del módulo.",
  },
  {
    id: "ai",
    number: 5,
    title: "Panel de ReSolve AI",
    description:
      "Asistente contextual que explica resultados y permite plantear problemas en lenguaje natural.",
    guest: "Puede conversar y recibir orientación.",
    student: "Puede usar el contexto de sus cálculos.",
    teacher: "Puede pedir explicaciones adicionales.",
    admin: "Supervisa el uso, no administra el modelo desde la interfaz.",
  },
  {
    id: "history",
    number: 6,
    title: "Historial",
    description:
      "Registra los cálculos del usuario y permite buscarlos, repetirlos, copiarlos o eliminarlos.",
    guest: "Se guarda solo en el navegador.",
    student: "Se guarda en Supabase y se sincroniza.",
    teacher: "Usa el mismo historial de usuario registrado.",
    admin: "No accede al historial privado de otros usuarios.",
  },
  {
    id: "settings",
    number: 7,
    title: "Tema y animaciones",
    description:
      "Permite elegir el tema visual y activar o desactivar las animaciones decorativas.",
    guest: "Puede personalizar su experiencia local.",
    student: "La preferencia se conserva en el navegador.",
    teacher: "Puede ajustar la presentación para clase.",
    admin: "No cambia la configuración global desde aquí.",
  },
];

export interface RoleRow {
  role: string;
  access: string;
  can: string;
}

export const ROLE_MATRIX: RoleRow[] = [
  {
    role: "Visitante / invitado",
    access: "Público, sin cuenta",
    can: "Resolver ejercicios, usar la Calculadora Universal, consultar teoría y guardar historial local.",
  },
  {
    role: "Estudiante registrado",
    access: "Cuenta verificada",
    can: "Todo lo del invitado más historial en la nube, perfil y persistencia entre dispositivos.",
  },
  {
    role: "Docente",
    access: "Cuenta registrada normal",
    can: "Las mismas funciones que un estudiante. No tiene privilegios administrativos adicionales.",
  },
  {
    role: "Administrador",
    access: "Rol administrativo en Supabase",
    can: "Gestionar usuarios, revisar políticas, respaldos y editar las fechas de los diagramas.",
  },
];

export interface TrainingSession {
  number: number;
  topic: string;
  audience: string;
  duration: string;
  /** Se deja vacío hasta que la coordinación confirme el calendario. */
  date: string;
  objective: string;
}

export const TRAINING_DATE_NOTICE =
  "Las fechas de la capacitación se publicarán en una actualización de este documento cuando estén confirmadas.";

export const TRAINING_SESSIONS: TrainingSession[] = [
  {
    number: 1,
    topic: "Introducción y navegación general",
    audience: "Estudiantes y docentes",
    duration: "45 min",
    date: "",
    objective: "Conocer el acceso, el menú, los módulos y las vistas.",
  },
  {
    number: 2,
    topic: "Resolución por módulos",
    audience: "Estudiantes y docentes",
    duration: "60 min",
    date: "",
    objective: "Practicar Calcular, Paso a Paso y Teoría en distintos subtemas.",
  },
  {
    number: 3,
    topic: "Calculadora Universal con IA",
    audience: "Estudiantes y docentes",
    duration: "45 min",
    date: "",
    objective: "Plantear problemas en lenguaje natural y revisar la clasificación.",
  },
  {
    number: 4,
    topic: "Historial y repaso",
    audience: "Estudiantes",
    duration: "30 min",
    date: "",
    objective: "Buscar, repetir, copiar y depurar cálculos.",
  },
  {
    number: 5,
    topic: "Administración, políticas y respaldo",
    audience: "Personal de soporte",
    duration: "60 min",
    date: "",
    objective: "Operar la plataforma y atender incidencias.",
  },
];

export const MANUAL_SUPPORT_FAQ = [
  {
    question: "¿Necesito instalar algo para usar ReSolve?",
    answer:
      "No. La plataforma funciona en el navegador. La instalación corresponde al personal administrativo o de soporte.",
  },
  {
    question: "¿Qué pasa si uso la plataforma sin cuenta?",
    answer:
      "Puedes resolver ejercicios y el historial se guarda localmente en ese navegador. Al registrarte, los cálculos nuevos se guardan en la nube.",
  },
  {
    question: "¿Un docente tiene permisos especiales?",
    answer:
      "No. El docente utiliza una cuenta registrada normal, con las mismas funciones que un estudiante.",
  },
  {
    question: "¿Por qué no veo un cálculo anterior?",
    answer:
      "El historial local pertenece al navegador donde se creó. Si cambias de equipo, inicia sesión para consultar el historial en la nube.",
  },
  {
    question: "¿Qué hago si la IA no responde?",
    answer:
      "Puedes seguir usando los módulos y el motor local. Si el problema continúa, contacta al soporte administrativo.",
  },
];
