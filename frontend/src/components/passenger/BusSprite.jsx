import { assetPath, assetSlugOr } from "@equipo17/shared"
import { FRESHNESS, spriteTreatment } from "@/lib/freshness"
import { useContinuousHeading, usePrefersReducedMotion } from "@/lib/motion"

/**
 * El sprite de una micro, en dos capas:
 *
 * - la exterior NO rota: ahi van el anillo de frescura y la etiqueta, que deben
 *   leerse derechos en cualquier rumbo;
 * - la interior rota con el rumbo, que es lo unico que tiene direccion.
 *
 * La frescura no se pinta con color — el color ya significa "empresa" — sino
 * con saturacion, anillo y movimiento, y siempre acompanada de texto.
 *
 * @param {string} assetSlug        slug del dibujo (ver ASSET_SLUGS de shared)
 * @param {number|null} heading     grados desde el norte, o null si no se sabe
 * @param {string} status           estado de frescura ya resuelto
 * @param {string} statusLabel      su texto, para el lector de pantalla
 * @param {string} companyColor     hex de la empresa: pinta el anillo
 * @param {number} size             lado en px
 * @param {boolean} rotate          false en listas, donde el rumbo no aporta
 * @param {string|null} label       etiqueta bajo el sprite (codigo + estado)
 */
export function BusSprite({
  assetSlug,
  heading = null,
  status = FRESHNESS.NO_SIGNAL,
  statusLabel = "",
  companyColor = "#1d1d1f",
  size = 44,
  rotate = true,
  label = null,
  selected = false,
}) {
  const reducedMotion = usePrefersReducedMotion()
  const angle = useContinuousHeading(rotate ? heading : null)
  const treatment = spriteTreatment(status)
  // Solo LIVE se mueve. Con senal intermitente o sin senal el marcador se
  // congela: una micro sin senal deslizandose por el mapa seria una mentira en
  // movimiento. Y nunca se extrapola mas alla del ultimo dato conocido.
  const animated = treatment.animated && !reducedMotion

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Capa exterior: no rota nunca. */}
      {treatment.ring === "pulse" && animated && (
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-40"
          style={{ backgroundColor: companyColor }}
          aria-hidden="true"
        />
      )}
      {treatment.ring !== "none" && (
        <span
          className={`absolute inset-0 rounded-full border-2 bg-white/70 ${
            treatment.ring === "dashed" ? "border-dashed" : "border-solid"
          }`}
          style={{ borderColor: companyColor }}
          aria-hidden="true"
        />
      )}
      {selected && (
        <span
          className="absolute -inset-1 rounded-full border-2 border-[var(--ink)]"
          aria-hidden="true"
        />
      )}

      {/* Capa interior: la unica que rota. */}
      <div
        className="absolute inset-0"
        style={{
          transform: angle == null ? undefined : `rotate(${angle}deg)`,
          transition: animated ? "transform 700ms ease-out" : "none",
          willChange: "transform",
          filter: treatment.filter,
        }}
      >
        <img
          src={assetPath(assetSlugOr(assetSlug))}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      </div>

      {label && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--line)] bg-white/95 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-[var(--ink)] shadow-sm"
        >
          {label}
        </span>
      )}

      {statusLabel && <span className="sr-only">{statusLabel}</span>}
    </div>
  )
}
