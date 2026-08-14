import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, BusFront, ChevronUp, Navigation } from "lucide-react"
import { CompanyCard } from "@/components/passenger/CompanyCard"
import { MicroCard } from "@/components/passenger/MicroCard"
import { MicroDetail } from "@/components/passenger/MicroDetail"
import { formatDistance, outOfServiceStyle } from "@/lib/freshness"
import { usePrefersReducedMotion } from "@/lib/motion"

/**
 * Las tres posiciones de reposo, como fraccion del alto visible.
 *
 * Tres y no dos porque con dos no hay forma de mirar el mapa y la lista a la
 * vez: o la hoja tapa el mapa o esconde la lista. "Asomada" deja ver la cabecera
 * y una micro y media — lo justo para que se note que hay mas abajo.
 */
const DETENTS = { peek: 0.3, mid: 0.55, full: 0.92 }
const ORDER = ["peek", "mid", "full"]

/** Cuanto se proyecta el gesto hacia adelante segun su velocidad, en ms. */
const FLICK_PROJECTION_MS = 140
/** Desde el cuerpo, un arrastre solo se reconoce despues de estos pixeles. */
const DRAG_START_PX = 8
/** Bajo esto el gesto fue un toque y lo resuelve el `click` del asa. */
const TAP_SLOP_PX = 6

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function StopPicker({ stops, selectedStopId, onSelectStop }) {
  if (!stops.length) return null

  const ordered = [...stops].sort((a, b) => a.stopOrder - b.stopOrder)

  return (
    <div className="pb-3">
      <p className="px-1 pb-1.5 text-[12px] text-[var(--ink-soft)]">
        {selectedStopId ? "Distancias medidas a este paradero" : "Elige tu paradero para ver distancias"}
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {ordered.map((stop) => {
          const isSelected = stop.id === selectedStopId

          return (
            <button
              key={stop.id}
              type="button"
              onClick={() => onSelectStop?.(isSelected ? null : stop.id)}
              aria-pressed={isSelected}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${
                isSelected
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
            >
              {stop.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Atajo al paradero mas cercano. Conecta la ubicacion con lo unico que la app
 * responde de verdad: con 61 paraderos en el selector, encontrar el propio a
 * mano es justo la friccion que sobra para alguien apurado en la calle.
 */
function NearestStopHint({ nearest, selectedStopId, onSelectStop }) {
  if (!nearest || nearest.stop.id === selectedStopId) return null

  return (
    <button
      type="button"
      onClick={() => onSelectStop?.(nearest.stop.id)}
      className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--mist)] px-3.5 py-2.5 text-left"
    >
      <Navigation className="h-4 w-4 shrink-0 text-[#1a73e8]" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--ink)]">
          Paradero más cercano a ti: {nearest.stop.name}
        </span>
        <span className="block text-[12px] text-[var(--ink-soft)]">
          A {formatDistance(nearest.distanceMeters)} de donde estás
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-medium text-white">
        Usar
      </span>
    </button>
  )
}

function OutOfServiceState({ scoped }) {
  const style = outOfServiceStyle()

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--mist)] px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
        <BusFront className="h-6 w-6 text-[var(--ink-soft)]" strokeWidth={1.5} />
      </div>
      <p className="text-[17px] font-semibold" style={{ color: style.color }}>
        {style.message}
      </p>
      <p className="max-w-[34ch] text-[13px] leading-snug text-[var(--ink-soft)]">
        {scoped
          ? "Ninguna micro está transmitiendo en este recorrido. No es que no sepamos dónde van: es que no hay ninguna en ruta ahora."
          : "Ninguna micro está transmitiendo ahora, de ninguna empresa. No es que no sepamos dónde van: es que no hay ninguna en ruta."}
      </p>
    </div>
  )
}

export function RideSheet({
  buses = [],
  route,
  stops = [],
  selectedStopId,
  onSelectStop,
  selectedBusId,
  onSelectBus,
  onReportOccupancy,
  myVotes = {},
  outOfService,
  elapsedMs = 0,
  truncated = false,
  company = null,
  companyLoading = false,
  companyFares = [],
  nearestStop = null,
  selectedBus = null,
  detailRoute = null,
  detailRouteLoading = false,
  selectedStop = null,
}) {
  const reducedMotion = usePrefersReducedMotion()
  const sheetRef = useRef(null)
  const scrollRef = useRef(null)
  const gesture = useRef(null)
  // Fila de cada micro, para traer a la vista la que se estaba mirando al volver
  // a la lista.
  const rowsRef = useRef(new Map())
  const lastSelected = useRef(null)
  // El navegador dispara `click` despues de un arrastre sobre el mismo boton:
  // sin esta marca el gesto movia la hoja y el click la volvia a mover.
  const dragged = useRef(false)

  const [viewportH, setViewportH] = useState(() => window.innerHeight)
  const [detent, setDetent] = useState("mid")
  const [dragOffset, setDragOffset] = useState(null)

  const sinMicros = outOfService || buses.length === 0

  // El alto se mide del contenedor real y no de `window`: en el movil la barra
  // del navegador entra y sale, y `100svh` y `window.innerHeight` no coinciden.
  useLayoutEffect(() => {
    const parent = sheetRef.current?.parentElement
    if (!parent) return

    const update = () => setViewportH(parent.clientHeight)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  const fullHeight = viewportH * DETENTS.full
  const offsets = useMemo(
    () => ({
      full: 0,
      mid: viewportH * (DETENTS.full - DETENTS.mid),
      peek: viewportH * (DETENTS.full - DETENTS.peek),
    }),
    [viewportH],
  )

  const offset = dragOffset ?? offsets[detent]
  const dragging = dragOffset != null

  // Cuanto de la hoja se ve, publicado como variable CSS en el contenedor. Con
  // eso los controles flotantes del mapa se apoyan sobre el borde de la hoja sin
  // que el padre tenga que re-renderizarse en cada frame del arrastre.
  useLayoutEffect(() => {
    const parent = sheetRef.current?.parentElement
    parent?.style.setProperty("--sheet-visible", `${Math.max(0, fullHeight - offset)}px`)
  }, [fullHeight, offset])

  const nearestDetent = useCallback(
    (value) =>
      ORDER.reduce((best, name) =>
        Math.abs(offsets[name] - value) < Math.abs(offsets[best] - value) ? name : best,
      ),
    [offsets],
  )

  // Elegir una micro en el mapa tiene que dejarla a la vista: si la hoja quedo
  // asomada, el detalle que se acaba de pedir estaria bajo el borde inferior.
  useEffect(() => {
    if (selectedBusId) setDetent((current) => (current === "peek" ? "mid" : current))
  }, [selectedBusId])

  /*
   * Que la micro elegida QUEDE A LA VISTA, en los dos sentidos.
   *
   * Con 43 micros en ruta, tocar en el mapa una que cae en el puesto 30 la
   * marcaba fuera de pantalla: la interfaz respondia y nadie lo veia, o sea que
   * para el pasajero no pasaba nada. Ahora la hoja se convierte en su ficha, asi
   * que basta con llevar el scroll arriba — si venia leyendo la lista a mitad de
   * camino, la ficha aparecia empezada por la mitad.
   *
   * Al volver, la fila de la que se estaba mirando se trae a la vista: sin eso,
   * la lista reaparece desde arriba y hay que buscarla de nuevo.
   *
   * El doble `requestAnimationFrame` deja que React pinte antes de medir. La
   * animacion de la hoja no interfiere: lo que se anima es `translateY` y no el
   * alto, asi que el contenedor con scroll mide igual durante la transicion.
   */
  useEffect(() => {
    const previo = lastSelected.current
    lastSelected.current = selectedBusId

    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const behavior = reducedMotion ? "auto" : "smooth"
        if (selectedBusId) scrollRef.current?.scrollTo({ top: 0, behavior })
        else if (previo) rowsRef.current.get(previo)?.scrollIntoView({ block: "nearest", behavior })
      })
    })

    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [selectedBusId, reducedMotion])

  // Una vez que el gesto es un arrastre de la hoja, el scroll nativo de la lista
  // tiene que dejar de competir. `touchmove` no puede ser pasivo para poder
  // cancelarlo, y por eso se registra a mano y no como prop de React.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const block = (event) => {
      if (gesture.current?.active) event.preventDefault()
    }

    el.addEventListener("touchmove", block, { passive: false })
    return () => el.removeEventListener("touchmove", block)
  }, [])

  function handlePointerDown(event, fromHandle) {
    if (event.pointerType === "mouse" && event.button !== 0) return

    gesture.current = {
      id: event.pointerId,
      startY: event.clientY,
      startOffset: offsets[detent],
      offset: offsets[detent],
      lastY: event.clientY,
      lastT: event.timeStamp,
      prevY: event.clientY,
      prevT: event.timeStamp,
      // Desde el asa el arrastre manda de inmediato. Desde el cuerpo hay que
      // ganarselo, o arrastrar para leer la lista cerraria la hoja.
      active: fromHandle,
      moved: false,
    }
    // Con captura, el `pointerup` llega aunque el dedo termine fuera del asa.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return

    if (!state.active) {
      const delta = event.clientY - state.startY
      // Solo hacia abajo y solo con la lista arriba del todo: en cualquier otro
      // caso el dedo esta haciendo scroll y no moviendo la hoja.
      if (delta <= DRAG_START_PX || (scrollRef.current?.scrollTop ?? 0) > 0) return
      state.active = true
      // Se reancla aca para que la hoja no salte los pixeles del umbral.
      state.startY = event.clientY
    }

    state.prevY = state.lastY
    state.prevT = state.lastT
    state.lastY = event.clientY
    state.lastT = event.timeStamp

    const delta = event.clientY - state.startY
    if (Math.abs(delta) > TAP_SLOP_PX) state.moved = true

    state.offset = clamp(state.startOffset + delta, offsets.full, offsets.peek)
    setDragOffset(state.offset)
  }

  function handlePointerUp(event) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return
    gesture.current = null
    setDragOffset(null)

    if (!state.active) return

    dragged.current = state.moved

    // La velocidad decide junto con la posicion: un movimiento corto pero rapido
    // hacia abajo tiene que cerrar aunque no haya recorrido media distancia, que
    // es como se siente natural un "flick".
    const elapsed = Math.max(1, state.lastT - state.prevT)
    const velocity = (state.lastY - state.prevY) / elapsed
    setDetent(nearestDetent(state.offset + velocity * FLICK_PROJECTION_MS))
  }

  // El asa sigue siendo un boton: cicla las posiciones. Es el camino con teclado
  // y con lector de pantalla, donde no hay gesto que valga.
  function handleHandleClick() {
    if (dragged.current) {
      dragged.current = false
      return
    }
    setDetent((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
  }

  return (
    <div
      ref={sheetRef}
      style={{
        height: fullHeight,
        transform: `translateY(${offset}px)`,
        transition:
          dragging || reducedMotion ? "none" : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl border-t border-[var(--line)] bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <button
        type="button"
        onClick={handleHandleClick}
        onPointerDown={(event) => handlePointerDown(event, true)}
        // `touch-action: none` va SOLO aca. En el contenedor con scroll mataria
        // el scroll de la lista, que es la trampa clasica de este gesto.
        className="flex w-full shrink-0 touch-none flex-col items-center gap-1.5 rounded-t-3xl bg-transparent pt-2.5 pb-1.5"
        aria-label={`Hoja de micros: ${detent === "full" ? "completa" : detent === "mid" ? "a media altura" : "asomada"}. Arrástrala o púlsala para cambiar de altura.`}
      >
        <div className="h-1 w-9 rounded-full bg-[var(--line)]" />
        {detent === "peek" && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">
            <ChevronUp className="h-3 w-3" />
            {selectedBus
              ? `${selectedBus.routeCode} · ${selectedBus.company.name}`
              : sinMicros
                ? "No hay micros en ruta ahora"
                : `${buses.length} ${buses.length === 1 ? "micro en ruta" : "micros en ruta"}`}
          </span>
        )}
      </button>

      <div
        ref={scrollRef}
        onPointerDown={(event) => handlePointerDown(event, false)}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8"
      >
        {/*
         * Elegida una micro, la hoja DEJA de ser lista y pasa a ser su ficha. La
         * lista sirve para elegir; una vez elegida, seguir mostrando las otras 42
         * es ruido sobre la unica que importa. La flecha atras es el camino de
         * vuelta, y esta arriba a la izquierda donde ya se busca.
         */}
        {selectedBus ? (
          <>
            <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-white/95 px-4 pb-3 pt-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => onSelectBus?.(null)}
                aria-label="Volver a la lista de micros"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mist)] text-[var(--ink)]"
              >
                <ArrowLeft className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
                  Micro actual
                </h2>
                <p className="truncate text-[13px] text-[var(--ink-soft)]">
                  {selectedBus.routeCode} · {selectedBus.company.name}
                </p>
              </div>
            </div>

            <MicroCard
              bus={selectedBus}
              selected
              onSelect={() => onSelectBus?.(null)}
              onReportOccupancy={onReportOccupancy}
              myVote={myVotes[selectedBus.tripId] ?? null}
              elapsedMs={elapsedMs}
              showVote={false}
            />

            <MicroDetail
              bus={selectedBus}
              route={detailRoute}
              routeLoading={detailRouteLoading}
              company={company}
              companyLoading={companyLoading}
              stop={selectedStop}
              elapsedMs={elapsedMs}
              myVote={myVotes[selectedBus.tripId] ?? null}
              onReportOccupancy={onReportOccupancy}
            />
          </>
        ) : (
          <>
        <div className="px-1 pb-3">
          {route ? (
            <>
              <h2 className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
                {route.name}
              </h2>
              <p className="text-[13px] text-[var(--ink-soft)]">
                {route.code ? `${route.code} · ` : ""}
                {route.originName} ↔ {route.destinationName}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
                Micros en ruta ahora
              </h2>
              <p className="text-[13px] text-[var(--ink-soft)]">
                Todas las empresas. Busca un recorrido para ver solo el tuyo.
              </p>
            </>
          )}
        </div>

        <NearestStopHint
          nearest={nearestStop}
          selectedStopId={selectedStopId}
          onSelectStop={onSelectStop}
        />

        {/* La ficha de la empresa aparece cuando hay recorrido y ninguna micro
            que tocar: es justo entonces cuando su telefono es la respuesta util.
            Con micros en ruta, el detalle completo vive en el modal de la micro
            y esta tarjeta no compite con la lista. */}
        {route && sinMicros && (
          <CompanyCard
            company={company}
            fares={companyFares}
            loading={companyLoading}
            reason="Opera este recorrido"
          />
        )}

        <StopPicker stops={stops} selectedStopId={selectedStopId} onSelectStop={onSelectStop} />

        {sinMicros ? (
          <OutOfServiceState scoped={Boolean(route)} />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Se dice cuando la lista esta recortada: mostrar menos micros de
                las que hay sin avisarlo tambien es ocultar informacion. */}
            {truncated && (
              <p className="px-1 text-[12px] text-[var(--ink-soft)]">
                Hay más micros en ruta de las que caben en esta lista. Acerca el mapa o busca tu
                recorrido.
              </p>
            )}
            {buses.map((bus) => (
              <MicroCard
                key={bus.tripId}
                ref={(node) => {
                  if (node) rowsRef.current.set(bus.tripId, node)
                  else rowsRef.current.delete(bus.tripId)
                }}
                bus={bus}
                selected={bus.tripId === selectedBusId}
                onSelect={onSelectBus}
                onReportOccupancy={onReportOccupancy}
                myVote={myVotes[bus.tripId] ?? null}
                elapsedMs={elapsedMs}
              />
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
