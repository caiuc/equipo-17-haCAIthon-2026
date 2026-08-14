import { useEffect, useMemo, useState } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCompanies } from "@/hooks/useCompanies"
import { useRegions } from "@/hooks/useRegions"

/**
 * Hoja de filtros: empresa (multi-select), region -> zona (single-select) y
 * favoritos. No bloquea el buscador si `/companies` o `/regions` fallan: el
 * error se declara aqui adentro, nunca tapa la busqueda por texto.
 */
export function FilterSheet({
  open,
  onOpenChange,
  selectedCompanyIds,
  selectedZoneId,
  favoritesOnly,
  onApply,
}) {
  const { companies, error: companiesError } = useCompanies()
  const { regions, error: regionsError } = useRegions()

  const [companyIds, setCompanyIds] = useState(selectedCompanyIds)
  const [zoneId, setZoneId] = useState(selectedZoneId)
  const [onlyFavorites, setOnlyFavorites] = useState(favoritesOnly)
  const [regionId, setRegionId] = useState(
    () => regions.find((region) => region.zones.some((zone) => zone.id === selectedZoneId))?.id ?? "",
  )

  // La hoja queda montada entre aperturas (portal), asi que su borrador no se
  // resetea solo si el estado de arriba cambio con la hoja cerrada (ej. al
  // quitar un chip). Se resincroniza cada vez que se abre.
  useEffect(() => {
    if (!open) return
    setCompanyIds(selectedCompanyIds)
    setZoneId(selectedZoneId)
    setOnlyFavorites(favoritesOnly)
    setRegionId(
      regions.find((region) => region.zones.some((zone) => zone.id === selectedZoneId))?.id ?? "",
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir, no en cada cambio de props
  }, [open])

  const zonesOfRegion = useMemo(
    () => regions.find((region) => region.id === regionId)?.zones ?? [],
    [regions, regionId],
  )

  const toggleCompany = (id) =>
    setCompanyIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const clear = () => {
    setCompanyIds([])
    setZoneId(null)
    setRegionId("")
    setOnlyFavorites(false)
  }

  const apply = () => {
    onApply({ companyIds, zoneId, favoritesOnly: onlyFavorites })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <label className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3.5 py-3">
            <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
              <Star className="h-4 w-4" />
              Solo favoritos
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
            />
          </label>

          <div>
            <p className="pb-2 text-[13px] font-medium text-[var(--ink-soft)]">Zona</p>
            {regionsError && (
              <p className="pb-2 text-[12px] text-[var(--accent-deep)]">
                No se pudieron cargar las zonas. Puedes seguir filtrando por empresa.
              </p>
            )}
            <div className="flex gap-2">
              <select
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value)
                  setZoneId(null)
                }}
                className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-white px-2.5 text-[13px] text-[var(--ink)]"
              >
                <option value="">Región</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <select
                value={zoneId ?? ""}
                onChange={(e) => setZoneId(e.target.value || null)}
                disabled={!regionId}
                className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-white px-2.5 text-[13px] text-[var(--ink)] disabled:opacity-50"
              >
                <option value="">Zona / ciudad</option>
                {zonesOfRegion.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="pb-2 text-[13px] font-medium text-[var(--ink-soft)]">Empresa</p>
            {companiesError && (
              <p className="pb-2 text-[12px] text-[var(--accent-deep)]">
                No se pudieron cargar las empresas. Puedes seguir filtrando por zona.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {companies.map((company) => (
                <label
                  key={company.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={companyIds.includes(company.id)}
                    onChange={() => toggleCompany(company.id)}
                  />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: company.color }}
                  />
                  <span className="text-[13px] text-[var(--ink)]">{company.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={clear}>
            Limpiar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
            onClick={apply}
          >
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
