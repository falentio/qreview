"use client"

import * as React from "react"
import { Archive, Command, List, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"

export type AppUser = {
  name: string
  email: string
  image: string | null
  role?: string | null
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  pathname: string
  user: AppUser
}

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  prefetch?: boolean
  items?: {
    title: string
    url: string
    prefetch?: boolean
  }[]
}

function isActivePath(pathname: string, url: string) {
  return url === "/app" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar({ pathname, user, ...props }: AppSidebarProps) {
  const navMain: NavItem[] = [
    {
      title: "Ringkasan",
      url: "/app",
      icon: Command,
      isActive: isActivePath(pathname, "/app"),
      prefetch: true,
    },
  ]

  const qrNavigation: NavItem[] = [
    {
      title: "Semua kode QR",
      url: "/app/qr-codes",
      icon: List,
      isActive: pathname === "/app/qr-codes",
      prefetch: true,
    },
    {
      title: "Klaim kode QR",
      url: "/app/qr-codes/adopt",
      icon: UserPlus,
      isActive: pathname === "/app/qr-codes/adopt",
      prefetch: true,
    },
    {
      title: "Diarsipkan",
      url: "/app/qr-codes/archived",
      icon: Archive,
      isActive: pathname === "/app/qr-codes/archived",
      prefetch: true,
    },
  ]

  const navSecondary =
    user.role === "admin" ? [{ title: "Admin", url: "/admin", icon: ShieldCheck }] : []

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={pathname} />
        <NavMain items={qrNavigation} pathname={pathname} label="Kode QR" />
        {navSecondary.length ? <NavSecondary items={navSecondary} className="mt-auto" /> : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
