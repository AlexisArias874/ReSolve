import type { ManualDefinition } from "./types";

export const ADMIN_MANUAL: ManualDefinition = {
  id: "administrativo",
  title: "Manual Administrativo",
  shortTitle: "Administrativo",
  audience: "Coordinación, soporte, DevOps y administración de la plataforma",
  description:
    "Explica la operación de ReSolve: descripción del sistema, puesta a punto, privilegios, políticas y soporte.",
  version: "1.0",
  updatedAt: "Octubre 2026",
  sections: [
    {
      id: "presentacion",
      title: "1. Descripción del sistema",
      blocks: [
        {
          type: "paragraph",
          text: "ReSolve es una aplicación web de apoyo al aprendizaje matemático universitario. Permite resolver ejercicios de seis áreas, consultar el procedimiento y la teoría, y conservar un historial de cálculos por usuario.",
        },
        {
          type: "paragraph",
          text: "La plataforma no requiere instalación en el equipo del usuario final: se accede desde un navegador. La administración se concentra en la aplicación desplegada, la base de datos de Supabase, el servicio de autenticación y el proveedor de inteligencia artificial.",
        },
        {
          type: "table",
          headers: ["Componente", "Función", "Responsable sugerido"],
          rows: [
            ["Aplicación Next.js", "Interfaz y rutas de API.", "DevOps"],
            ["Supabase / PostgreSQL", "Persistencia y usuarios.", "Administrador de BD"],
            ["Supabase Auth", "Registro, sesión y verificación.", "Administrador de BD / DevOps"],
            ["Servicio de IA", "Calculadora Universal.", "Integración de IA"],
            ["Variables de entorno", "Configuración y secretos.", "DevOps / Seguridad"],
          ],
        },
      ],
    },
    {
      id: "configuracion",
      title: "2. Configuración e instalación",
      blocks: [
        {
          type: "paragraph",
          text: "La puesta a punto se realiza una sola vez por entorno. Se recomienda preparar un entorno de desarrollo, uno de pruebas y uno de producción, con credenciales independientes.",
        },
        {
          type: "steps",
          items: [
            {
              title: "Obtener el código",
              text: "Clonar el repositorio en un equipo con Node.js 20 o superior y acceso a la red.",
            },
            {
              title: "Instalar dependencias",
              text: "Ejecutar npm install desde la raíz del proyecto.",
            },
            {
              title: "Configurar variables",
              text: "Crear .env.local con la URL y la clave anónima de Supabase, y la clave del servicio de IA.",
            },
            {
              title: "Preparar la base de datos",
              text: "Ejecutar la migración de user_history y las políticas RLS en el editor SQL de Supabase.",
            },
            {
              title: "Verificar autenticación",
              text: "Comprobar el registro, la verificación por correo y la URL de redirección del callback.",
            },
            {
              title: "Compilar y desplegar",
              text: "Ejecutar npm run build y publicar la aplicación en el entorno correspondiente.",
            },
            {
              title: "Validar la operación",
              text: "Resolver un ejercicio como invitado, registrarse y comprobar el historial en la nube.",
            },
          ],
        },
        {
          type: "table",
          headers: ["Variable", "Uso", "Ámbito"],
          rows: [
            ["NEXT_PUBLIC_SUPABASE_URL", "URL del proyecto de Supabase.", "Cliente y servidor"],
            ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Clave pública de acceso.", "Cliente y servidor"],
            ["GROQ_API_KEY", "Acceso al servicio de IA.", "Solo servidor"],
          ],
          caption: "Nunca se deben incluir claves reales en documentos, capturas o repositorios.",
        },
        {
          type: "callout",
          title: "Lista de verificación",
          text: "Antes de publicar: variables configuradas, migraciones aplicadas, RLS activo, registro y verificación funcionando, historial probado y respaldo inicial creado.",
          tone: "important",
        },
      ],
    },
    {
      id: "privilegios",
      title: "3. Privilegios de usuarios",
      blocks: [
        {
          type: "paragraph",
          text: "El sistema distingue entre visitantes, estudiantes, docentes y administradores. El docente es un usuario registrado normal: puede usar la plataforma y su historial, pero no tiene privilegios administrativos.",
        },
        { type: "roleMatrix" },
        {
          type: "paragraph",
          text: "El control efectivo se implementa con seguridad a nivel de fila. Cada usuario autenticado solo puede consultar, insertar o eliminar sus propios registros; el administrador opera desde el panel de Supabase con credenciales protegidas.",
        },
        {
          type: "code",
          title: "Regla de acceso del historial",
          language: "sql",
          code: `create policy "select_own_history"
  on public.user_history for select
  using (auth.uid() = user_id);

create policy "insert_own_history"
  on public.user_history for insert
  with check (auth.uid() = user_id);

create policy "delete_own_history"
  on public.user_history for delete
  using (auth.uid() = user_id);`,
          note: "El administrador no consulta el historial privado desde la aplicación.",
        },
      ],
    },
    {
      id: "politicas",
      title: "4. Políticas de funcionamiento",
      blocks: [
        {
          type: "list",
          items: [
            "Seguridad de la información: las claves viven en variables de entorno y nunca en el código fuente.",
            "Privacidad: el historial es privado por usuario; los invitados no envían datos al servidor.",
            "Respaldo: programar respaldos periódicos de la base de datos desde Supabase.",
            "Disponibilidad: la plataforma depende de Supabase y del servicio de IA; ante una falla de IA, el motor local sigue operando.",
            "Uso aceptable: la plataforma es de apoyo académico y no debe usarse para vulnerar evaluaciones.",
            "Control de cambios: todo cambio se versiona y pasa por revisión del líder del proyecto.",
            "Mantenimiento: revisar mensualmente políticas RLS, dependencias y límites del servicio de IA.",
          ],
        },
        {
          type: "callout",
          title: "Incidencias de seguridad",
          text: "Si se detecta una clave expuesta, se debe revocar de inmediato, generar una nueva y revisar los registros de acceso antes de volver a publicar.",
          tone: "important",
        },
      ],
    },
    {
      id: "operacion",
      title: "5. Operación, respaldo y soporte",
      blocks: [
        {
          type: "paragraph",
          text: "El soporte administrativo atiende dudas de acceso, recuperación de cuentas, verificación de correo y comportamiento del historial. Las fallas matemáticas o de interfaz se canalizan al equipo técnico con el módulo, el subtema y la expresión utilizada.",
        },
        {
          type: "table",
          headers: ["Tarea", "Frecuencia", "Responsable"],
          rows: [
            ["Revisar respaldos de Supabase", "Semanal", "Administrador de BD"],
            ["Revisar consumo del servicio de IA", "Mensual", "Integración de IA"],
            ["Actualizar dependencias críticas", "Mensual", "DevOps"],
            ["Probar registro e historial", "Antes de cada entrega", "QA"],
            ["Revisar políticas RLS", "Mensual", "Seguridad / DBA"],
          ],
        },
        {
          type: "steps",
          items: [
            {
              title: "Recibir la incidencia",
              text: "Registrar usuario, fecha, módulo, subtema y descripción del problema.",
            },
            {
              title: "Clasificar",
              text: "Distinguir entre acceso, datos, cálculo, IA o interfaz.",
            },
            {
              title: "Contener",
              text: "Si hay riesgo de seguridad o pérdida de datos, suspender el cambio y respaldar antes de actuar.",
            },
            {
              title: "Corregir y verificar",
              text: "Aplicar la corrección en un entorno de pruebas y validar el flujo afectado.",
            },
            {
              title: "Cerrar",
              text: "Documentar la causa, la solución y la evidencia de la prueba.",
            },
          ],
        },
      ],
    },
    {
      id: "referencias",
      title: "6. Referencias entre manuales",
      blocks: [
        {
          type: "paragraph",
          text: "La instalación técnica, el SQL y los diagramas se detallan en el Manual Técnico. La explicación de la interfaz y el uso de cada módulo se encuentran en el Manual de Usuario. Este manual evita repetir esos contenidos y solo los referencia.",
        },
        {
          type: "list",
          items: [
            "Manual Técnico: arquitectura, base de datos, UML y código.",
            "Manual de Usuario: navegación, módulos, historial y capacitación.",
            "Documentación interactiva: diagramas del proyecto.",
          ],
        },
      ],
    },
  ],
};
