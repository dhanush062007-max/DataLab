"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Database, 
  FormInput, 
  Wand2, 
  Compass, 
  BarChart3, 
  Calculator, 
  BrainCircuit, 
  FlaskConical, 
  FileText, 
  Settings,
  LogOut
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export const mainNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Datasets", href: "/datasets", icon: Database },
  { name: "Data Collection", href: "/collection", icon: FormInput },
  { name: "Data Cleaning", href: "/cleaning", icon: Wand2 },
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Visualization", href: "/visualization", icon: BarChart3 },
  { name: "Statistics", href: "/statistics", icon: Calculator },
  { name: "Machine Learning", href: "/ml", icon: BrainCircuit },
  { name: "Experiments", href: "/experiments", icon: FlaskConical },
  { name: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <FlaskConical className="w-8 h-8 text-primary" />
        <div className="flex flex-col">
          <span className="font-bold text-xl leading-none">DataLab</span>
          <span className="text-[10px] text-sidebar-foreground/60 tracking-wider">Collect • Analyze • Build</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Link 
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
