import { assetPath, assetSlugOr } from "@equipo17/shared"
import { FRESHNESS, freshnessStyle, spriteTreatment } from "@/lib/freshness"
import { useContinuousHeading, usePrefersReducedMotion } from "@/lib/motion"

/**
 * Sombra propia del vehiculo. Reemplaza al disco blanco que antes lo separaba
 * del mapa: `drop-shadow` sigue el alfa del PNG, asi que despega la silueta del
 * fondo sin dibujar ninguna figura alrededor. Sin esto una micro clara sobre
 * una calle blanca desaparece.
 */
const LIFT_SHADOW = "drop-shadow(0 2px 2px rgba(0,0,0,0.35))"

/**
 * Contorno de la micro seleccionada: cuatro sombras duras de 1,5 px que tambien
 * siguen la silueta. Un anillo `rounded-full` volveria a poner el circulo que se
 * quito, y ademas encerraria al vehiculo en una forma que no es la suya.
 */
const SELECTED_OUTLINE = [
  "drop-shadow(1.5px 0 0 #1d1d1f)",
  "drop-shadow(-1.5px 0 0 #1d1d1f)",
  "drop-shadow(0 1.5px 0 #1d1d1f)",
  "drop-shadow(0 -1.5px 0 #1d1d1f)",
].join(" ")

/**
 * El sprite de una micro, en dos capas:
 *
 * - la exterior NO rota: ahi va la etiqueta, que debe leerse derecha en
 *   cualquier rumbo;
 * - la interior rota con el rumbo, que es lo unico que tiene direccion.
 *
 * Sobre el mapa se ve el vehiculo solo, sin disco ni anillo detras. La frescura
 * (§4.5) no se pierde por eso: viaja por tres canales que no son el color del
 * vehiculo —
 *
 * 1. el tratamiento del dibujo (saturacion plena en vivo, apagado con senal
 *    intermitente, gris y translucido sin senal), que es el canal principal;
 * 2. el punto de estado junto a la etiqueta, que late solo cuando esta en vivo;
 * 3. el texto de la etiqueta y el `aria-label`, que es lo que hace que funcione
 *    para alguien daltonico o con el telefono al sol.
 *
 * @param {string} assetSlug        slug del dibujo (ver ASSET_SLUGS de shared)
 * @param {number|null} heading     grados desde el norte, o null si no se sabe
 * @param {string} status           estado de frescura ya resuelto
 * @param {string} statusLabel      su texto, para el lector de pantalla
 * @param {number} size             lado en px
 * @param {boolean} rotate          false en listas, donde el rumbo no aporta
 * @param {string|null} label       etiqueta bajo el sprite (codigo + estado)
 */
export function BusSprite({
  assetSlug,
  heading = null,
  status = FRESHNESS.NO_SIGNAL,
  statusLabel = "",
  size = 44,
  rotate = true,
  label = null,
  selected = false,
}) {
  const reducedMotion = usePrefersReducedMotion()
  const angle = useContinuousHeading(rotate ? heading : null)
  const treatment = spriteTreatment(status)
  const style = freshnessStyle(status)
  // Solo LIVE se mueve. Con senal intermitente o sin senal el marcador se
  // congela: una micro sin senal deslizandose por el mapa seria una mentira en
  // movimiento. Y nunca se extrapola mas alla del ultimo dato conocido.
  const animated = treatment.animated && !reducedMotion

  const filter = [
    treatment.filter === "none" ? null : treatment.filter,
    selected ? SELECTED_OUTLINE : null,
    LIFT_SHADOW,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Capa interior: la unica que rota. */}
      <div
        className="absolute inset-0"
        style={{
          transform: angle == null ? undefined : `rotate(${angle}deg)`,
          transition: animated ? "transform 700ms ease-out" : "none",
          willChange: "transform",
          filter,
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
          className={`absolute left-1/2 top-full mt-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm ${
            selected
              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
              : "border-[var(--line)] bg-white/95 text-[var(--ink)]"
          }`}
        >
          {/* El pulso de "en vivo" sin anillo: un punto chico que late al lado
              del texto que ya lo dice. Latir alrededor del vehiculo obligaba a
              dibujar un circulo; aca el mismo movimiento cabe en 6 px y ademas
              queda pegado a su explicacion escrita. */}
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dotClass} ${
              animated ? "animate-pulse" : ""
            }`}
          />
          {label}
        </span>
      )}

      {statusLabel && <span className="sr-only">{statusLabel}</span>}
    </div>
  )
}
