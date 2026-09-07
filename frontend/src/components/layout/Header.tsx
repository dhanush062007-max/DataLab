"use client";

import { Search, Sun, Moon, Bell, Menu, X, FlaskConical, Settings, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import { mainNavItems } from "./Sidebar";
import Link from "next/link";

export function Header() {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showNotification, setShowNotification] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Initial fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    
    // Listen for auth/metadata updates (e.g. from Settings page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    
    // Sync theme
    const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    if (isDark) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }

    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/datasets?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Safe fallback for user initials
  const getInitials = () => {
    if (!user) return "U";
    const name = user.user_metadata?.full_name || user.email || "User";
    return name.substring(0, 2).toUpperCase();
  };

  const getName = () => {
    if (!user) return "User";
    return user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  };

  const getRole = () => {
    if (!user) return "Student";
    return user.user_metadata?.role_title || "Student";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-20 w-full bg-background border-b border-border flex items-center justify-between px-4 h-16 md:px-6">
        <div className="flex items-center md:hidden">
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-foreground mr-4" />
          </button>
          <span className="font-bold text-lg">DataLab</span>
        </div>

      <div className="hidden md:flex flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search datasets, analyses, or anything..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full h-10 pl-10 pr-4 rounded-full bg-muted border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4 ml-auto">
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button 
          onClick={() => setShowNotification(false)}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground relative transition-colors"
        >
          <Bell className="w-5 h-5" />
          {showNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-background"></span>}
        </button>
        
        <div className="flex items-center gap-3 pl-2 md:pl-4 md:border-l border-border">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {getInitials()}
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-semibold leading-none">{getName()}</span>
            <span className="text-xs text-muted-foreground mt-1">{getRole()}</span>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          
          {/* Drawer */}
          <div className="relative w-64 h-full bg-card flex flex-col shadow-xl">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-6 h-6 text-primary" />
                <span className="font-bold text-lg leading-none">DataLab</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {mainNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="p-4 border-t border-border space-y-1">
              <Link 
                href="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
