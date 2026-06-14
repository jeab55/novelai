import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Feather, BookOpen, Layers, Moon, Sun, Settings, Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem("novelai-dark") === "true");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("novelai-dark", dark);
  }, [dark]);
  return [dark, setDark];
}

export default function AppLayout({ children }) {
  const [dark, setDark] = useDarkMode();
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "นิยาย", icon: BookOpen },
    { to: "/series", label: "งานของฉัน", icon: Layers },
  ];

  const isActive = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
              <Feather className="w-4.5 h-4.5 text-primary" />
            </div>
            <span className="text-lg font-heading font-bold text-foreground tracking-tight">NovelAi</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1.5 ${isActive(to) ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:block mr-2">{user?.full_name || user?.email}</span>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Link to="/trash">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={() => logout()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}