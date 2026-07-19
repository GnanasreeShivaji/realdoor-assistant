import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileInput, UserSquare2, BookOpenText, PackageCheck, History, Settings, ShieldCheck, BarChart3, GitBranch } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const WORKSPACE = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Document intake", url: "/intake", icon: FileInput },
  { title: "Applicant profile", url: "/profile", icon: UserSquare2 },
  { title: "Rules reference", url: "/rules", icon: BookOpenText },
  { title: "Application packet", url: "/packet", icon: PackageCheck },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];
const SYSTEM = [
  { title: "Audit history", url: "/history", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">RealDoor</div>
              <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Application Copilot</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACE.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SYSTEM.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Current session</div>
            <div className="font-mono text-xs text-sidebar-foreground">RD-CA97A4F00A</div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Human review required
            </div>
          </div>
        ) : (
          <div className="mx-auto h-1.5 w-1.5 rounded-full bg-warning" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
