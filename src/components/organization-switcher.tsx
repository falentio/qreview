"use client"

import * as React from "react"
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function OrganizationLogo({ logo, small = false }: { logo?: string | null; small?: boolean }) {
  if (logo) {
    return <img src={logo} alt="" className={small ? "size-3.5 rounded-sm" : "size-4 rounded-sm"} />
  }

  return <Building2 className={small ? "size-3.5 shrink-0" : "size-4"} aria-hidden="true" />
}

export function OrganizationSwitcher() {
  const { isMobile } = useSidebar()
  const { data: organizations, isPending } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState<string | null>(null)

  const selectedOrganization =
    organizations?.find(
      (organization) => organization.id === (selectedOrganizationId ?? activeOrganization?.id),
    ) ?? organizations?.[0]

  async function selectOrganization(organizationId: string) {
    const result = await authClient.organization.setActive({ organizationId })
    if (!result.error) setSelectedOrganizationId(organizationId)
  }

  if (!selectedOrganization) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" aria-hidden="true" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {isPending ? "Loading organizations..." : "No organizations"}
              </span>
              <span className="truncate text-xs">
                {isPending ? "Please wait" : "Create one to get started"}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={selectedOrganization.name}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <OrganizationLogo logo={selectedOrganization.logo} />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{selectedOrganization.name}</span>
              <span className="truncate text-xs">{selectedOrganization.slug}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {organizations?.map((organization, index) => (
                <DropdownMenuItem
                  key={organization.id}
                  onClick={() => void selectOrganization(organization.id)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <OrganizationLogo logo={organization.logo} small />
                  </div>
                  <span className="truncate">{organization.name}</span>
                  {organization.id === selectedOrganization.id ? (
                    <Check className="ml-auto size-4" />
                  ) : null}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" disabled>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
