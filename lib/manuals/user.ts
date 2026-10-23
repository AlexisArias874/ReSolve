import type { ManualDefinition } from "./types";

export const USER_MANUAL: ManualDefinition = {
  id: "usuario",
  title: "Manual de Usuario",
  shortTitle: "Usuario",
  audience: "Estudiantes, docentes y público general",
  description:
    "Guía práctica para navegar ReSolve, resolver ejercicios, consultar el historial y aprovechar la capacitación.",
  version: "1.0",
  updatedAt: "Octubre 2026",
  sections: [
    {
      id: "presentacion",
      title: "1. Introducción",
      blocks: [
        {
          type: "paragraph",
          text: "ReSolve es una plataforma web para resolver ejercicios de matemáticas universitarias. Permite trabajar con seis áreas, consultar el resultado, revisar el procedimiento paso a paso y repasar la teoría relacionada.",
        },
        {
          type: "paragraph",
          text: "Puedes usar la plataforma como invitado o crear una cuenta. El invitado conserva su historial únicamente en el navegador; el usuario registrado lo guarda en la nube y puede consultarlo desde otros dispositivos.",
        },
        {
          type: "callout",
          title: "Docentes",
          text: "Un docente utiliza una cuenta registrada normal. No necesita permisos especiales ni una pantalla distinta: sus funciones son las mismas que las de un estudiante.",
          tone: "note",
        },
        {
          type: "list",
          items: [
            "No requiere instalar programas en el equipo.",
            "Funciona en navegadores modernos de escritorio y móvil.",
            "El historial local permanece en el navegador donde se creó.",
            "La cuenta registrada habilita el historial en la nube.",
          ],
        },
      ],
    },
    {
      id: "interfaz",
      title: "2. Recorrido por la interfaz",
      blocks: [
        {
          type: "paragraph",
          text: "El panel principal se organiza en zonas fáciles de identificar. La siguiente vista general muestra la posición de cada una; después se describe lo que puede hacer cada tipo de usuario.",
        },
        { type: "interfaceMap" },
        {
          type: "table",
          headers: ["Zona", "Función principal", "Invitado", "Estudiante / docente", "Administrador"],
          rows: [
            ["Menú lateral", "Módulos, calculadora, recursos y tema.", "Acceso completo", "Acceso completo", "Consulta"],
            ["Encabezado", "Subtema y vistas Calcular / Paso a Paso / Teoría.", "Disponible", "Disponible", "Disponible"],
            ["Área de trabajo", "Entrada, resultado, pasos y teoría.", "Resolver", "Resolver y guardar", "Verificar"],
            ["Panel de IA", "Explicaciones y problemas en lenguaje natural.", "Disponible", "Disponible", "Supervisa"],
            ["Historial", "Consultar, repetir y eliminar cálculos.", "Local", "Nube", "No accede al historial ajeno"],
            ["Tema y animaciones", "Apariencia y movimiento.", "Preferencia local", "Preferencia local", "Preferencia local"],
          ],
          caption: "Resumen de actores por zona de la interfaz.",
        },
        {
          type: "steps",
          items: [
            {
              title: "Menú lateral",
              text: "A la izquierda se encuentran la Calculadora Universal y los módulos. Al elegir uno, se muestran sus subtemas y el área de trabajo cambia.",
            },
            {
              title: "Encabezado",
              text: "En la parte superior aparecen el módulo y el subtema activos. También están las vistas Calcular, Paso a Paso y Teoría, además de los accesos a historial, enfoque e IA.",
            },
            {
              title: "Selector de subtemas",
              text: "Debajo del encabezado puedes cambiar de tema sin regresar al menú principal.",
            },
            {
              title: "Área central",
              text: "Contiene el campo de entrada, el botón Calcular y el resultado. En las otras vistas muestra el procedimiento o la teoría.",
            },
            {
              title: "Barra lateral derecha",
              text: "El panel de ReSolve AI permite pedir explicaciones y plantear problemas en lenguaje natural.",
            },
            {
              title: "Recursos",
              text: "Al final del menú están Documentación, Contribuidores y el acceso al tema visual y las animaciones.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "El modo enfoque oculta los paneles laterales y el encabezado para dejar solo el área de trabajo. El botón Restaurar devuelve la vista al estado anterior.",
        },
      ],
    },
    {
      id: "modulos",
      title: "3. Uso de cada módulo",
      blocks: [
        {
          type: "paragraph",
          text: "Cada módulo agrupa subtemas con una calculadora, un procedimiento y una explicación teórica. El catálogo siguiente se genera desde la misma definición que utiliza el panel, por lo que siempre coincide con la oferta disponible.",
        },
        { type: "moduleCatalog" },
        {
          type: "table",
          headers: ["Módulo", "Qué resuelve", "Ejemplo de entrada"],
          rows: [
            ["Matemáticas I", "Aritmética, álgebra, geometría, funciones, límites, derivadas e integrales.", "x^2 - 5*x + 6 = 0"],
            ["Lógica", "Proposiciones, equivalencias e inferencias.", "p → (q ∧ ¬p)"],
            ["Financieras", "Interés simple y compuesto, anualidades y amortización.", "M = C*(1+i)^n"],
            ["Computacionales", "Matrices, determinantes, sistemas, raíces, interpolación y errores.", "x + y = 5; x - y = 1"],
            ["Estadística", "Descriptiva, tablas de frecuencia, probabilidad, distribuciones y regresión.", "12, 15, 11, 18"],
            ["Optimización", "Programación lineal, simplex, asignación y teoría de colas.", "Max 3x + 5y"],
            ["Calculadora Universal", "Problemas en lenguaje natural.", "Resuelve 3x + 5 = 20"],
          ],
        },
        {
          type: "paragraph",
          text: "Dentro de un módulo, el selector de subtemas permite cambiar de tema sin perder el contexto general. La calculadora de cada subtema adapta la entrada y las opciones disponibles.",
        },
      ],
    },
    {
      id: "resolver",
      title: "4. Resolver un ejercicio",
      blocks: [
        {
          type: "steps",
          items: [
            {
              title: "Elige el módulo",
              text: "Selecciona el área matemática en el menú lateral.",
            },
            {
              title: "Elige el subtema",
              text: "Usa el selector superior para escoger el tema específico.",
            },
            {
              title: "Escribe la expresión",
              text: "Introduce el ejercicio en el campo de entrada. Puedes usar los botones de operadores cuando estén disponibles.",
            },
            {
              title: "Presiona Calcular",
              text: "El resultado aparece en el área de trabajo y el cálculo se registra en el historial.",
            },
            {
              title: "Revisa el procedimiento",
              text: "Cambia a Paso a Paso para ver las operaciones intermedias.",
            },
            {
              title: "Repasa la teoría",
              text: "Cambia a Teoría para consultar conceptos y fórmulas relacionadas.",
            },
          ],
        },
        {
          type: "table",
          headers: ["Vista", "Qué muestra", "Cuándo usarla"],
          rows: [
            ["Calcular", "Entrada, resultado y acciones rápidas.", "Para obtener la respuesta."],
            ["Paso a Paso", "Desglose del procedimiento.", "Para estudiar o comprobar el desarrollo."],
            ["Teoría", "Conceptos, reglas y fórmulas.", "Para repasar antes o después del ejercicio."],
          ],
        },
        {
          type: "callout",
          title: "Consejo",
          text: "Si el resultado no coincide con lo esperado, revisa la sintaxis de la expresión y consulta la vista Paso a Paso antes de volver a calcular.",
          tone: "note",
        },
      ],
    },
    {
      id: "historial",
      title: "5. Historial, perfil y Calculadora Universal",
      blocks: [
        {
          type: "paragraph",
          text: "El historial conserva los cálculos para que puedas repasarlos. En el panel aparece un resumen; la página de historial permite buscar, filtrar y gestionar todos los registros.",
        },
        {
          type: "steps",
          items: [
            {
              title: "Abrir el historial",
              text: "Usa el botón Mostrar historial del encabezado o entra a la página completa desde el panel.",
            },
            {
              title: "Buscar o filtrar",
              text: "Escribe una expresión o resultado, o elige un subtema en el filtro.",
            },
            {
              title: "Repetir un cálculo",
              text: "Selecciona un registro para cargar sus datos en el módulo correspondiente.",
            },
            {
              title: "Copiar o eliminar",
              text: "Copia el resultado o elimina registros individuales. La acción de vaciar afecta solo al historial propio.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "La Calculadora Universal recibe problemas en lenguaje natural, los clasifica y propone el módulo y el subtema adecuados. El asistente de IA puede explicar el resultado o ayudar a interpretar el enunciado.",
        },
        {
          type: "table",
          headers: ["Acción", "Invitado", "Usuario registrado"],
          rows: [
            ["Guardar cálculo", "En el navegador", "En Supabase"],
            ["Consultar desde otro equipo", "No", "Sí"],
            ["Editar perfil", "No", "Sí"],
            ["Eliminar historial", "Solo local", "Solo sus registros"],
          ],
        },
      ],
    },
    {
      id: "instalacion",
      title: "6. Plan de instalación, migración y captura",
      blocks: [
        {
          type: "paragraph",
          text: "El usuario final no instala ReSolve: abre la dirección de la plataforma en su navegador. La instalación del servidor corresponde al personal administrativo y se describe en el Manual Administrativo.",
        },
        {
          type: "table",
          headers: ["Origen", "Destino", "Método"],
          rows: [
            ["Ejercicios en apuntes o papel", "Historial de la plataforma", "Captura manual al calcular."],
            ["Historial local del invitado", "Historial en la nube", "Registrarse e iniciar sesión; los cálculos nuevos se guardan en la nube."],
            ["Datos de otro sistema", "user_history", "Importación controlada por el administrador."],
          ],
          caption: "Migración de datos.",
        },
        {
          type: "table",
          headers: ["Dato capturado", "Ejemplo"],
          rows: [
            ["Módulo", "mat1"],
            ["Subtema", "algebra"],
            ["Expresión", "x^2 - 5*x + 6 = 0"],
            ["Resultado", "x = 2, x = 3"],
            ["Fecha", "Automática"],
          ],
          caption: "Estructura de cada registro del historial.",
        },
        {
          type: "callout",
          title: "Cambio de equipo",
          text: "El historial local no viaja con la cuenta. Para conservar los cálculos entre dispositivos, inicia sesión antes de continuar trabajando.",
          tone: "note",
        },
      ],
    },
    {
      id: "capacitacion",
      title: "7. Capacitación",
      blocks: [
        {
          type: "paragraph",
          text: "La capacitación está organizada en sesiones breves por audiencia. Los estudiantes y docentes reciben la misma formación funcional; el personal de soporte recibe una sesión adicional de administración.",
        },
        { type: "trainingCalendar" },
        {
          type: "table",
          headers: ["Sesión", "Tema", "Dirigido a", "Duración"],
          rows: [
            ["1", "Introducción y navegación general", "Estudiantes y docentes", "45 min"],
            ["2", "Resolución por módulos y vistas", "Estudiantes y docentes", "60 min"],
            ["3", "Calculadora Universal con IA", "Estudiantes y docentes", "45 min"],
            ["4", "Historial y repaso", "Estudiantes", "30 min"],
            ["5", "Administración, políticas y respaldo", "Soporte", "60 min"],
          ],
        },
        {
          type: "paragraph",
          text: "Cada sesión combina una demostración y una práctica guiada. Al final se recomienda resolver un ejercicio completo, consultar su procedimiento y localizarlo en el historial.",
        },
      ],
    },
    {
      id: "soporte",
      title: "8. Preguntas frecuentes y soporte",
      blocks: [
        {
          type: "list",
          items: [
            "¿Necesito instalar algo? No; la plataforma funciona en el navegador.",
            "¿Qué pasa si uso la plataforma sin cuenta? El historial se guarda solo en ese navegador.",
            "¿Un docente tiene permisos especiales? No; utiliza una cuenta registrada normal.",
            "¿Por qué no veo un cálculo anterior? Puede pertenecer a otro navegador o a otra cuenta.",
            "¿Qué hago si la IA no responde? Puedes seguir usando los módulos y el motor local; si persiste, contacta a soporte.",
          ],
        },
        {
          type: "callout",
          title: "Soporte",
          text: "Para reportar un problema, indica el módulo, el subtema, la expresión utilizada y una descripción breve de lo ocurrido. No compartas contraseñas ni claves de acceso.",
          tone: "important",
        },
      ],
    },
  ],
};
