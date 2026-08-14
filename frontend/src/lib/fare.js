/**
 * Como se muestra la tarifa de adulto.
 *
 * Son tres casos y no dos: `null` es "no publicada" y `0` es gratuito de verdad
 * (MuniBus Paine). Colapsarlos con un `?? 0` diria "Gratis" donde en realidad no
 * sabemos, que es la misma clase de mentira que mostrar una posicion vieja como
 * fresca. Ver fareFor() en packages/shared/src/fare.ts.
 */

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

/**
 * @param {number|null|undefined} amountClp tarifa adulto en pesos
 * @returns {{label: string, tone: "amount"|"free"|"unknown"}}
 */
export function formatFare(amountClp) {
  if (amountClp == null) return { label: "Tarifa por confirmar", tone: "unknown" }
  if (amountClp === 0) return { label: "Gratis", tone: "free" }
  return { label: CLP.format(amountClp), tone: "amount" }
}
