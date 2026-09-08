"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, Activity, FlaskConical, BarChart3, DatabaseZap, Search, Compass } from "lucide-react";

export default function LandingPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Fetch published datasets
    const fetchDatasets = async () => {
      // We only fetch datasets where status = 'PUBLISHED'
      // Note: This relies on the new RLS policy allowing public SELECT on PUBLISHED datasets
      const { data, error } = await supabase
        .from("datasets")
        .select(`
          *,
          profiles:owner_id (full_name)
        `)
        .eq("status", "PUBLISHED")
        .order("created_at", { ascending: false });

      if (data) {
        setDatasets(data);
        setFetchErr(null);
      } else if (error) {
        console.error("Error fetching datasets:", error);
        setFetchErr(error.message);
      }
      setLoading(false);
    };

    fetchDatasets();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Database className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">DataLab</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {session ? (
              <Link href="/dashboard">
                <Button variant="default" className="rounded-full px-3 sm:px-6 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Go to Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-xs sm:text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">
                  Sign in
                </Link>
                <Link href="/register">
                  <Button variant="default" className="rounded-full px-3 sm:px-6 shadow-sm text-xs sm:text-sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-32 md:pb-40 px-4">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] bg-primary/20 rounded-full blur-[100px] opacity-70 animate-pulse" />
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-blue-500/15 rounded-full blur-[80px] animate-pulse delay-700" />
          <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-emerald-500/15 rounded-full blur-[100px] animate-pulse delay-1000" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Welcome to the future of Data Science
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tight mb-6 md:mb-8 bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/50 leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150 fill-mode-both">
            Explore. Analyze. <br className="hidden sm:block" /> Discover.
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-12 px-2 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300 fill-mode-both">
            A collaborative data science platform. Explore published datasets, run statistical tests, train machine learning models, and build beautiful visualizations directly in your browser.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-5 px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-500 fill-mode-both">
            <Link href={session ? "/dashboard" : "/register"} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-full px-8 h-14 text-base shadow-[0_0_40px_-10px_rgba(var(--primary),0.5)] hover:shadow-[0_0_60px_-10px_rgba(var(--primary),0.7)] hover:scale-105 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {session ? "Open Workspace" : "Create Free Account"}
              </Button>
            </Link>
            <a href="#explore" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-14 text-base bg-background/20 backdrop-blur-md border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-300">
                Explore Datasets
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Published Datasets Grid */}
      <section id="explore" className="py-16 md:py-24 bg-muted/30 border-t border-border/50 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Community Datasets</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Discover and interact with data published by DataLab researchers.</p>
            </div>
            <div className="relative group w-full md:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search datasets..." 
                className="pl-9 pr-4 py-2 bg-background border border-border rounded-full text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full md:w-64 transition-all shadow-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card border border-border rounded-2xl h-64 animate-pulse shadow-sm" />
              ))}
            </div>
          ) : fetchErr ? (
            <div className="text-center py-24 bg-red-50 border border-red-200 rounded-2xl shadow-sm text-red-600">
              <h3 className="text-xl font-bold mb-2">Error Loading Datasets</h3>
              <p>{fetchErr}</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-24 bg-card border border-border border-dashed rounded-2xl shadow-sm">
              <Compass className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Published Datasets Yet</h3>
              <p className="text-muted-foreground">Be the first to publish a dataset to the community!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {datasets.map((ds, idx) => (
                <Link key={ds.id} href={`/explore/${ds.id}`} className="group relative animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both" style={{ animationDelay: `${idx * 150}ms` }}>
                  {/* Glowing Border Effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500 blur-sm group-hover:duration-200" />
                  
                  <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all h-full flex flex-col justify-between overflow-hidden">
                    {/* Hover Gradient Inner */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-5">
                        <div className="p-3.5 bg-primary/10 text-primary rounded-xl shadow-inner border border-primary/10">
                          <DatabaseZap className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 shadow-sm">
                          Published
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold mb-3 line-clamp-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-foreground group-hover:to-foreground/60 transition-all">{ds.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-6">
                        {ds.description || "No description provided for this dataset."}
                      </p>
                    </div>

                    <div className="pt-5 border-t border-border/40 flex items-center justify-between mt-auto relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-[11px] font-bold uppercase text-muted-foreground border border-border shadow-sm">
                          {ds.profiles?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground/80">{ds.profiles?.full_name || "Anonymous"}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{new Date(ds.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="inline-flex items-center text-sm text-primary font-semibold group-hover:gap-2 transition-all">
                        Explore <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border/50 bg-background">
        <p>© {new Date().getFullYear()} DataLab. All rights reserved.</p>
      </footer>
    </div>
  );
}
