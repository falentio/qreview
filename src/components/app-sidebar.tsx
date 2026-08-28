"use client"

import * as React from "react"
import {
  Command,
  Frame,
  LifeBuoy,
  PieChart,
  QrCode,
  Send,
  ShieldCheck,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
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
  items?: {
    title: string
    url: string
  }[]
}

function isActivePath(pathname: string, url: string) {
  return url === "/app" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar({ pathname, user, ...props }: AppSidebarProps) {
  const navMain: NavItem[] = [
    {
      title: "Overview",
      url: "/app",
      icon: Command,
      isActive: isActivePath(pathname, "/app"),
    },
    {
      title: "QR codes",
      url: "/app/qr-codes",
      icon: QrCode,
      isActive: isActivePath(pathname, "/app/qr-codes"),
      items: [
        { title: "All QR codes", url: "/app/qr-codes" },
        { title: "Create a QR code", url: "/app/qr-codes/new" },
        { title: "Archived", url: "/app/qr-codes/archived" },
      ],
    },
    {
      title: "Team",
      url: "/app/team",
      icon: Users,
      isActive: isActivePath(pathname, "/app/team"),
      items: [
        { title: "Members", url: "/app/team" },
        { title: "Invitations", url: "/app/team/invitations" },
      ],
    },
    {
      title: "Settings",
      url: "/app/settings",
      icon: Settings2,
      isActive: isActivePath(pathname, "/app/settings"),
      items: [
        { title: "General", url: "/app/settings" },
        { title: "Billing", url: "/app/settings/billing" },
      ],
    },
  ]

  const projects = [
    { name: "Google Reviews", url: "/app/qr-codes", icon: Frame },
    { name: "Events", url: "/app/qr-codes", icon: PieChart },
    { name: "Menus", url: "/app/qr-codes", icon: QrCode },
  ]

  const navSecondary = [
    ...(user.role === "admin" ? [{ title: "Admin", url: "/admin", icon: ShieldCheck }] : []),
    { title: "Support", url: "/app", icon: LifeBuoy },
    { title: "Feedback", url: "/app", icon: Send },
  ]

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={pathname} />
        <NavProjects projects={projects} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
