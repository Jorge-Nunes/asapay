import { LayoutDashboard, FileText, Settings, PlayCircle, MessageSquare, LogOut, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Cobranças",
    url: "/cobrancas",
    icon: FileText,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: MessageSquare,
  },
  {
    title: "Execuções",
    url: "/execucoes",
    icon: PlayCircle,
  },
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings,
  },
];

export function AppSidebar({ onLogout }: { onLogout?: () => void }) {
  const [location] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    onLogout?.();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex flex-col items-center gap-2">
          <img 
            src="/asapay-logo.png?v=1763982786" 
            alt="AsaPay Logo" 
            className="h-10 w-auto object-contain"
          />
          <p className="text-xs text-muted-foreground text-center">Gestão de Cobranças</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-6 border-t border-sidebar-border space-y-3">
        <button
          onClick={handleLogout}
          data-testid="button-logout"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full p-2 rounded hover-elevate"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
        <div className="text-xs text-muted-foreground">
          v1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
