import { Link } from "react-router-dom"
import { ChevronDown, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ACCESSES,
  DASHBOARD_ACCESS,
  ROLE_LABEL,
  displayNameOf,
  initialOf,
  panelLabelFor,
  panelPathFor,
} from "./accesses"

const LOGIN_ACCESSES = ACCESSES.filter((access) => access.needsLogin)
const OPEN_ACCESSES = ACCESSES.filter((access) => !access.needsLogin)

const ITEM_CLASS = "gap-2.5 rounded-lg px-2 py-2"

function AccessItem({ access }) {
  const Icon = access.icon
  return (
    <DropdownMenuItem render={<Link to={access.to} />} className={ITEM_CLASS}>
      <Icon className="size-4 text-[var(--ink-soft)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] text-[var(--ink)]">{access.label}</span>
        {access.tagline && (
          <span className="text-[12px] text-[var(--ink-soft)]">{access.tagline}</span>
        )}
      </span>
    </DropdownMenuItem>
  )
}

/**
 * Estado de sesion de la navbar en escritorio.
 *
 * Sin sesion es la puerta de entrada a chofer y empresa; el mapa aparece en el
 * grupo "sin cuenta" y no bajo "iniciar sesion", porque entrar a ver si viene la
 * micro no exige registrarse y el menu no debe insinuar lo contrario.
 */
export function SessionMenu({ user, checking, onSignOut }) {
  if (checking) {
    return <span className="text-[13px] text-[var(--ink-soft)]">Revisando sesión…</span>
  }

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-9 gap-1.5 rounded-full border-[var(--line)] bg-transparent px-4 text-[13px] text-[var(--ink)]"
            />
          }
        >
          Ingresar
          <ChevronDown className="size-3.5 text-[var(--ink-soft)]" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2">Iniciar sesión</DropdownMenuLabel>
            {LOGIN_ACCESSES.map((access) => (
              <AccessItem key={access.to} access={access} />
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2">Sin cuenta</DropdownMenuLabel>
            {OPEN_ACCESSES.map((access) => (
              <AccessItem key={access.to} access={access} />
            ))}
            <AccessItem access={DASHBOARD_ACCESS} />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-9 gap-2 rounded-full border-[var(--line)] bg-transparent py-0 pl-1 pr-3"
          />
        }
      >
        <span className="grid size-7 place-items-center rounded-full bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-deep)]">
          {initialOf(user)}
        </span>
        <span className="max-w-[9rem] truncate text-[13px] text-[var(--ink)]">
          {displayNameOf(user)}
        </span>
        <ChevronDown className="size-3.5 text-[var(--ink-soft)]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <p className="truncate text-[14px] font-medium text-[var(--ink)]">
            {displayNameOf(user)}
          </p>
          <p className="truncate text-[12px] text-[var(--ink-soft)]">{user.email}</p>
          <Badge variant="secondary" className="mt-0.5">
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link to={panelPathFor(user.role)} />} className={ITEM_CLASS}>
          {panelLabelFor(user.role)}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={DASHBOARD_ACCESS.to} />} className={ITEM_CLASS}>
          {DASHBOARD_ACCESS.label}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" className={ITEM_CLASS} onClick={onSignOut}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
