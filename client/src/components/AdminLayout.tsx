import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Users,
  DollarSign,
  Menu,
  X,
  Shield,
  LogOut,
  ChevronRight,
  Key,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Pickaxe
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminSecretKeyModal from "@/components/AdminSecretKeyModal";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Deposits",
    href: "/admin/deposits",
    icon: ArrowDownCircle,
  },
  {
    title: "Withdrawals",
    href: "/admin/withdrawals",
    icon: ArrowUpCircle,
  },
  {
    title: "Transactions", 
    href: "/admin/transactions",
    icon: DollarSign,
  },
  {
    title: "Deposit Addresses",
    href: "/admin/addresses",
    icon: Key,
  },
  {
    title: "Audit Logs",
    href: "/admin/audit-logs",
    icon: ClipboardList,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSecretKeyModal, setShowSecretKeyModal] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  const handleSecretTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 800) {
      const nextCount = tapCount + 1;
      setTapCount(nextCount);
      if (nextCount >= 3) {
        setTapCount(0);
        setShowSecretKeyModal(true);
        toast({
          title: "🔐 Master Security Unlocked",
          description: "Admin Private Key rotation panel opened.",
          className: "bg-zinc-950 border-[#f7931a] text-white"
        });
      }
    } else {
      setTapCount(1);
    }
    setLastTapTime(now);
  };

  const mineBlockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/mining/mine-block");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Block Mined!",
        description: data.message || `Block #${data.block?.blockNumber} generated successfully.`,
        className: "bg-orange-600 text-white"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Mining Failed",
        description: err.message || "Could not mine block",
        variant: "destructive"
      });
    }
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Check if current path matches nav item (handle exact and nested routes)
  const isActiveRoute = (href: string) => {
    if (href === "/admin/users" && location === "/admin") {
      return true; // Default to Users tab when on /admin
    }
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-backdrop"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-72 bg-zinc-900 border-r border-zinc-800 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-800">
            <div 
              className="flex items-center gap-2 cursor-pointer select-none group"
              onClick={handleSecretTap}
              title="Triple tap for Admin Key Security"
            >
              <Shield className="h-6 w-6 text-[#f7931a] group-hover:scale-110 transition-transform" />
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors flex items-center gap-1.5">
                  B2B Admin
                  {tapCount > 0 && (
                    <span className="text-[10px] text-[#f7931a] font-mono opacity-70">
                      ({tapCount}/3)
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400">Dashboard</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-zinc-800"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                const hasActiveChild = item.children?.some(child => isActiveRoute(child.href));
                const isExpanded = item.children && (isActive || hasActiveChild);
                
                return (
                  <div key={item.href}>
                    {item.children ? (
                      <>
                        <div
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                            hasActiveChild
                              ? "text-[#f7931a]"
                              : "text-gray-300 hover:bg-zinc-800 hover:text-white"
                          )}
                        >
                          <Icon 
                            className={cn(
                              "h-5 w-5 transition-all duration-200",
                              hasActiveChild 
                                ? "text-[#f7931a]" 
                                : "text-gray-400 group-hover:text-[#f7931a]"
                            )}
                          />
                          <span className="flex-1">{item.title}</span>
                          <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded ? "rotate-90" : ""
                          )} />
                        </div>
                        {isExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActiveRoute(child.href);
                              
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                    isChildActive
                                      ? "bg-[#f7931a] text-black shadow-lg shadow-[#f7931a]/20"
                                      : "text-gray-400 hover:bg-zinc-800 hover:text-white"
                                  )}
                                  onClick={() => setSidebarOpen(false)}
                                  data-testid={`nav-link-${child.title.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <ChildIcon
                                    className={cn(
                                      "h-4 w-4 transition-all duration-200",
                                      isChildActive
                                        ? "text-black"
                                        : "text-gray-500 group-hover:text-[#f7931a]"
                                    )}
                                  />
                                  <span>{child.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link 
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-[#f7931a] text-black shadow-lg shadow-[#f7931a]/20"
                            : "text-gray-300 hover:bg-zinc-800 hover:text-white"
                        )}
                        onClick={() => setSidebarOpen(false)}
                        data-testid={`nav-link-${item.title.toLowerCase()}`}
                      >
                        <Icon 
                          className={cn(
                            "h-5 w-5 transition-all duration-200",
                            isActive 
                              ? "text-black" 
                              : "text-gray-400 group-hover:text-[#f7931a]"
                          )}
                        />
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-[#f7931a]/20 px-2 py-0.5 text-xs text-[#f7931a]">
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        )}
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="border-t border-zinc-800 p-4">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7931a]/20">
                <span className="text-sm font-bold text-[#f7931a]">
                  {user?.username?.charAt(0).toUpperCase() || "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.username || "Admin"}
                </p>
                <p className="text-xs text-gray-400">Super Admin</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full mt-2 justify-start gap-3 text-gray-300 hover:text-white hover:bg-zinc-800"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-72 flex flex-col h-screen">
        {/* Top Bar */}
        <header className="flex h-16 items-center gap-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60 px-6 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-zinc-800"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-menu-toggle"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 flex items-center justify-between">
            <div 
              onClick={handleSecretTap}
              className="cursor-pointer select-none group py-1"
              title="Triple tap to rotate Admin Private Key"
            >
              <h1 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors flex items-center gap-2">
                {navItems.find(item => isActiveRoute(item.href))?.title || "Admin Dashboard"}
                {tapCount > 0 && (
                  <span className="text-xs text-[#f7931a] font-mono opacity-80 px-1.5 py-0.5 rounded bg-[#f7931a]/10 border border-[#f7931a]/30">
                    {tapCount}/3 taps
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-400 group-hover:text-gray-300">
                Manage your B2B platform
              </p>
            </div>

            {/* Optional: Add any top bar actions here */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-semibold flex items-center gap-1.5"
                onClick={() => mineBlockMutation.mutate()}
                disabled={mineBlockMutation.isPending}
              >
                <Pickaxe className={`h-3.5 w-3.5 ${mineBlockMutation.isPending ? 'animate-spin' : ''}`} />
                {mineBlockMutation.isPending ? 'Mining...' : 'Mine Block'}
              </Button>
              <div 
                className="hidden md:flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors"
                onClick={handleSecretTap}
                title="Triple tap for Admin Private Key management"
              >
                <Shield className="h-4 w-4 text-[#f7931a]" />
                <span>Admin Mode</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-black overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Secret Admin Key Rotation Modal */}
      <AdminSecretKeyModal
        isOpen={showSecretKeyModal}
        onClose={() => setShowSecretKeyModal(false)}
      />
    </div>
  );
}