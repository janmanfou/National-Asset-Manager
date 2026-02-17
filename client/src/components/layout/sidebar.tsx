import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  Settings,
  ShieldCheck,
  Database,
  ChevronLeft,
  Menu,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: UploadCloud, label: "Batch Upload", href: "/upload" },
  { icon: FileText, label: "Processing Queue", href: "/processing" },
  { icon: Database, label: "Data Records", href: "/records" },
  { icon: ShieldCheck, label: "Audit Logs", href: "/audit" },
  { icon: Settings, label: "System Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("voter_auth");
    window.location.href = "/auth";
  };

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="md:hidden p-4 border-b flex items-center justify-between bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            V
          </div>
          <span>VoterData Engine</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-r-sidebar-border">
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center gap-2 font-semibold mb-8">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  V
                </div>
                <span>VoterData Engine</span>
              </div>
              <nav className="flex flex-col gap-2 flex-1">
                {sidebarItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        location === item.href
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/70"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </a>
                  </Link>
                ))}
              </nav>
              <div className="pt-6 border-t border-sidebar-border">
                <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border h-16">
          {!collapsed && (
            <div className="flex items-center gap-2 font-semibold animate-in fade-in duration-300">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
                V
              </div>
              <span>VoterData Engine</span>
            </div>
          )}
          {collapsed && (
             <div className="h-8 w-8 mx-auto rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
             V
           </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground h-6 w-6 ml-auto"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group relative",
                  location === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/70",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </a>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-4">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium">
              JD
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">John Doe</span>
                <span className="text-xs text-sidebar-foreground/50 truncate">System Admin</span>
              </div>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size={collapsed ? "icon" : "sm"} 
            className={cn(
              "w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              !collapsed && "justify-start"
            )}
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
            {!collapsed && "Logout"}
          </Button>
        </div>
      </aside>
    </>
  );
}
