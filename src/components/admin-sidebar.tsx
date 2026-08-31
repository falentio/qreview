"use client"

import * as React from "react"
import {
  Building2,
  Command,
  LayoutDashboard,
  LifeBuoy,
  QrCode,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { AppUser } from "@/components/app-sidebar"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type AdminSidebarProps = React.ComponentProps<typeof Sidebar> & {
  pathname: string
  user: AppUser
}

type AdminNavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  prefetch?: boolean
}

function isActivePath(pathname: string, url: string) {
  return url === "/admin" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)
}

export function AdminSidebar({ pathname, user, ...props }: AdminSidebarProps) {
  const navMain: AdminNavItem[] = [
    {
      title: "Overview",
      url: "/admin",
      icon: Command,
      isActive: isActivePath(pathname, "/admin"),
      prefetch: true,
    },
    {
      title: "QR codes",
      url: "/admin/qr-codes",
      icon: QrCode,
      isActive: isActivePath(pathname, "/admin/qr-codes"),
      prefetch: true,
    },
    {
      title: "Organizations",
      url: "/admin/organizations",
      icon: Building2,
      isActive: isActivePath(pathname, "/admin/organizations"),
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
      isActive: isActivePath(pathname, "/admin/users"),
    },
  ]

  const navSecondary = [
    { title: "App", url: "/app", icon: LayoutDashboard },
    { title: "Support", url: "/app", icon: LifeBuoy },
  ]

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="QR Admin" render={<a href="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">QR Admin</span>
                <span className="truncate text-xs">Platform control</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={pathname} label="Administration" />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
