import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  Columns3,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { useRelay, useTheme } from "@/lib/relay-store";
import { CommandBar } from "./command-bar";
import { NotificationPanel } from "./notification-panel";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/board", label: "Board", icon: Columns3, exact: false },
  { to: "/app/meetings", label: "Meetings", icon: Mic, exact: false },
  { to: "/app/review", label: "Review", icon: ClipboardCheck, exact: false },
];

function ProjectSwitcher() {
  const { projects, projectsLoading, projectsError, activeProject, setActiveProjectId } =
    useRelay();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors duration-150 hover:bg-secondary">
          <span className="truncate">
            {projectsLoading
              ? "Loading projects…"
              : projectsError
                ? "Projects unavailable"
                : (activeProject?.name ?? "No project")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[12px] text-muted-foreground">
          Projects
        </DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => setActiveProjectId(p.id)} className="gap-2">
            <Check
              className={cn(
                "size-4",
                activeProject?.id === p.id ? "opacity-100 text-primary" : "opacity-0",
              )}
            />
            {p.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/app/new-project" })} className="gap-2">
          <Plus className="size-4" />
          Create new project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-[13.5px] text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground",
        compact ? "size-8 justify-center" : "w-full px-2.5 py-2",
      )}
    >
      {theme === "dark" ? <Moon className="size-[17px]" /> : <Sun className="size-[17px]" />}
      {compact ? null : <span>{theme === "dark" ? "Dark" : "Light"} theme</span>}
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  /** Revokes the backend refresh session before returning to the sign-in screen. */
  async function signOut() {
    await logout();
    navigate({ to: "/login", replace: true });
  }
  return (
    <div className="flex h-full flex-col gap-6 border-r border-border bg-sidebar px-3 py-4">
      <div className="space-y-3">
        <Link to="/" className="flex items-center gap-2 px-1.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            R
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Relay</span>
        </Link>
        <ProjectSwitcher />
      </div>

      <nav className="flex-1 space-y-0.5" aria-label="Main">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors duration-150",
                active
                  ? "bg-primary-soft font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              ) : null}
              <item.icon className={cn("size-[17px]", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5">
        <Link
          to="/app/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors duration-150",
            pathname.startsWith("/app/settings")
              ? "bg-primary-soft font-medium text-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Settings
            className={cn("size-[17px]", pathname.startsWith("/app/settings") && "text-primary")}
          />
          Settings
        </Link>
        <ThemeToggle />
        <div className="pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-secondary">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
                  {user?.name.slice(0, 1).toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {user?.name ?? "Relay user"}
                  </span>
                  <span className="block truncate text-[12px] text-subtle">
                    {user?.email ?? ""}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => navigate({ to: "/app/account" })}>
                <Settings className="size-4" /> Account settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { unreadCount } = useRelay();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="fixed inset-y-0 w-60">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-foreground/20"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-[18px]" />
          </Button>
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left text-[13px] text-subtle transition-colors duration-150 hover:border-border-strong md:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Ask Relay to update your project...</span>
            <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[11px] text-subtle sm:block">
              ⌘K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="size-[18px]" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-90 p-0">
                <NotificationPanel />
              </PopoverContent>
            </Popover>
            <div className="hidden md:block">
              <ThemeToggle compact />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
