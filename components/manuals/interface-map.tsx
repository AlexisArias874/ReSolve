"use client";

import { UI_ZONES } from "@/lib/manuals/shared";

function Marker({ number }: { number: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-500 bg-white text-[10px] font-bold text-stone-800">
      {number}
    </span>
  );
}

export default function InterfaceMap({ print = false }: { print?: boolean }) {
  return (
    <figure className={print ? "pdf-interface-map" : "my-6"}>
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-stone-50 p-3">
        <div className="min-w-[660px]">
          <div className="flex gap-3">
            {/* Menú lateral */}
            <aside className="w-44 shrink-0 rounded-md border border-stone-300 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-serif text-sm font-bold text-stone-800">ReSolve</span>
                <Marker number={1} />
              </div>
              <div className="space-y-1.5">
                <div className="rounded border border-stone-300 bg-stone-100 px-2 py-1.5 text-[9px] font-medium text-stone-700">
                  Calculadora Universal
                </div>
                {["Matemáticas I", "Lógica", "Financieras", "Computacionales"].map((label) => (
                  <div key={label} className="px-2 py-1 text-[9px] text-stone-600">
                    {label}
                  </div>
                ))}
                <div className="mt-3 border-t border-stone-200 pt-2 text-[8px] uppercase tracking-wider text-stone-400">
                  Recursos
                </div>
                <div className="px-2 py-1 text-[9px] text-stone-600">Documentación</div>
                <div className="px-2 py-1 text-[9px] text-stone-600">Contribuidores</div>
              </div>
            </aside>

            {/* Área principal */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-stone-400">Módulo / subtema</div>
                  <div className="text-[11px] font-semibold text-stone-800">Aritmética</div>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-stone-500">
                  <span className="rounded border border-stone-300 px-2 py-1">Calcular</span>
                  <span className="rounded border border-stone-300 px-2 py-1">Paso a Paso</span>
                  <span className="rounded border border-stone-300 px-2 py-1">Teoría</span>
                  <Marker number={2} />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[9px] text-stone-500">
                <span className="rounded bg-stone-100 px-2 py-1 text-stone-700">Aritmética</span>
                <span>Álgebra</span>
                <span>Geometría</span>
                <span>Funciones</span>
                <span className="ml-auto">
                  <Marker number={3} />
                </span>
              </div>

              <div className="flex gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[8px] uppercase tracking-wider text-stone-400">Expresión matemática</span>
                    <Marker number={4} />
                  </div>
                  <div className="rounded border border-stone-300 bg-stone-50 px-2 py-2 text-[10px] text-stone-700">
                    ((3 + 5) * 2) + 12 / 4
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[8px] text-stone-400">Resultado</span>
                    <span className="font-serif text-xl font-bold text-stone-800">19</span>
                  </div>
                </div>

                <div className="w-40 shrink-0 rounded-md border border-stone-300 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[8px] uppercase tracking-wider text-stone-400">ReSolve AI</span>
                    <Marker number={5} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="rounded bg-stone-100 px-2 py-1.5 text-[8px] text-stone-600">
                      Explícame el procedimiento.
                    </div>
                    <div className="rounded border border-stone-300 px-2 py-1.5 text-[8px] text-stone-500">
                      Escribe un mensaje…
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-stone-400">Historial</div>
                  <div className="text-[9px] text-stone-600">6 cálculos guardados</div>
                </div>
                <Marker number={6} />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2">
            <span className="text-[9px] text-stone-600">Tema · Animaciones · Perfil</span>
            <Marker number={7} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {UI_ZONES.map((zone) => (
          <div key={zone.id} className="flex items-center gap-2 text-[10px] text-stone-600">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-400 text-[8px] font-bold">
              {zone.number}
            </span>
            {zone.title}
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-[11px] leading-5 text-stone-500">
        Vista esquemática del panel. Los números identifican las zonas descritas en este manual.
      </figcaption>
    </figure>
  );
}
