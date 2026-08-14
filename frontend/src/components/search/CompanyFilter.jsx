import { Check, X } from "lucide-react"

/**
 * Filtro por empresa: una fila de chips con el color de cada una.
 *
 * El color es el mismo que lleva la micro en el mapa (`company.color`), asi que
 * el chip y el sprite se reconocen entre si sin leer el nombre. Es multiple a
 * proposito: en un paradero por el que pasan dos empresas, ver solo una es
 * quedarse sin la mitad de la respuesta.
 *
 * Sin ninguna seleccionada el filtro esta apagado y se ven todas: es el estado
 * por defecto y el que responde "¿viene o no viene?" sin que nadie configure nada.
 */
export function CompanyFilter({ companies, selectedIds, onToggle, onClear, countByCompany }) {
  if (companies.length === 0) return null

  const filtrando = selectedIds.length > 0

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {/* "Todas" no es una empresa mas: es el boton de limpiar, y se ve activo
            cuando no hay filtro para que el estado por defecto sea evidente. */}
        <button
          type="button"
          onClick={onClear}
          aria-pressed={!filtrando}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] shadow-sm transition-colors ${
            filtrando
              ? "border-[var(--line)] bg-white text-[var(--ink)]"
              : "border-[var(--ink)] bg-[var(--ink)] font-medium text-white"
          }`}
        >
          {filtrando && <X className="h-3.5 w-3.5" />}
          {filtrando ? "Ver todas" : "Todas las empresas"}
        </button>

        {companies.map((company) => {
          const seleccionada = selectedIds.includes(company.id)
          const enRuta = countByCompany?.get(company.id) ?? 0

          return (
            <button
              key={company.id}
              type="button"
              onClick={() => onToggle(company.id)}
              aria-pressed={seleccionada}
              title={`${company.name} — ${enRuta} ${enRuta === 1 ? "micro" : "micros"} en ruta`}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] shadow-sm transition-colors ${
                seleccionada
                  ? "border-transparent font-medium text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
              // El color de la empresa es dato del servidor, no una clase de
              // Tailwind: va inline porque no se puede conocer al compilar.
              style={seleccionada ? { backgroundColor: company.color } : undefined}
            >
              {seleccionada ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: company.color }}
                />
              )}
              {company.name}
              {/* Cuantas tiene en ruta ahora mismo: evita filtrar a ciegas por
                  una empresa que no esta transmitiendo nada. */}
              <span className={seleccionada ? "opacity-80" : "text-[var(--ink-soft)]"}>
                {enRuta}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
