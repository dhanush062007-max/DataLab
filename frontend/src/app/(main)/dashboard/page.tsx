"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Database, Plus, Upload, Link as LinkIcon, FlaskConical, LayoutDashboard, DatabaseZap, BrainCircuit, ArrowRight, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ datasets: 0, records: 0, analyses: 0, experiments: 0 });
  const [recentDatasets, setRecentDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      // Fetch Real Metrics from Supabase
      const [datasetsRes, experimentsRes, statsRes, recentRes] = await Promise.all([
        supabase.from("datasets").select("id, row_count", { count: "exact" }).eq("owner_id", session.user.id),
        supabase.from("ml_experiments").select("id", { count: "exact" }).eq("owner_id", session.user.id),
        supabase.from("statistical_tests").select("id", { count: "exact" }).eq("owner_id", session.user.id),
        supabase.from("datasets").select("*").eq("owner_id", session.user.id).order("created_at", { ascending: false }).limit(5)
      ]);

      const totalRecords = datasetsRes.data?.reduce((sum, d) => sum + (d.row_count || 0), 0) || 0;

      setStats({
        datasets: datasetsRes.count || 0,
        records: totalRecords,
        analyses: statsRes.count || 0,
        experiments: experimentsRes.count || 0
      });

      setRecentDatasets(recentRes.data || []);
      setLoading(false);
    };

    fetchDashboardData();
  }, [router]);

  // Remove document click listener since we'll use a fixed overlay

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
      
      // Update local state and stats
      setRecentDatasets(recentDatasets.filter(ds => ds.id !== id));
      setStats(prev => ({ ...prev, datasets: Math.max(0, prev.datasets - 1) }));
    } catch (err: any) {
      alert(`Failed to delete dataset: ${err.message}`);
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Welcome & Metrics (Left/Top) */}
        <div className="flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}! 👋</h1>
            <p className="text-muted-foreground mt-1">Turn your data into meaningful insights with powerful tools for analysis, visualization and machine learning.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Datasets</p>
                <p className="text-2xl font-bold mt-0.5">{stats.datasets}</p>
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
              <div className="w-8 h-8 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-md flex items-center justify-center">
                <DatabaseZap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Records</p>
                <p className="text-2xl font-bold mt-0.5">{stats.records.toLocaleString()}</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Analyses</p>
                <p className="text-2xl font-bold mt-0.5">{stats.analyses}</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-md flex items-center justify-center">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Experiments</p>
                <p className="text-2xl font-bold mt-0.5">{stats.experiments}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to action (Right/Bottom) */}
        <div className="w-full md:w-80 bg-gradient-to-br from-indigo-500 to-primary rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BrainCircuit className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="p-2 bg-white/20 rounded-lg w-max mb-4 backdrop-blur-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">Start Your Analysis Journey</h2>
            <p className="text-indigo-100 text-sm mb-6">Create a dataset, collect data, clean it, and unlock valuable insights with DataLab.</p>
            <Link href="/datasets/new">
              <Button variant="secondary" className="w-full bg-white text-primary hover:bg-zinc-100 font-semibold group flex items-center justify-between px-4">
                Create New Dataset
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Datasets */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Recent Datasets</h3>
            <Link href="/datasets" className="text-sm font-medium text-primary hover:underline flex items-center">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
          <div className="space-y-4">
            
            {recentDatasets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                No datasets yet. Create one to get started!
              </div>
            ) : (
              recentDatasets.map((dataset) => (
                <div 
                  key={dataset.id} 
                  onClick={() => router.push(`/datasets/${dataset.id}`)}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-border gap-2"
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm truncate">{dataset.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{dataset.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {dataset.source_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{dataset.row_count || 0} rows • {dataset.column_count || 0} columns</span>
                  </div>
                  <div className="flex items-center gap-4 relative">
                    <span className="hidden sm:inline-block text-xs text-muted-foreground">
                      {new Date(dataset.created_at).toLocaleDateString()}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === dataset.id ? null : dataset.id);
                      }}
                      className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === dataset.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                          }}
                        />
                        <div className="absolute right-0 top-8 w-40 bg-card border border-border rounded-md shadow-lg z-50 py-1 flex flex-col overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/datasets/${dataset.id}`);
                            }}
                            className="px-4 py-2 text-sm hover:bg-muted text-left w-full relative z-50"
                          >
                            Open Dataset
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              handleDelete(dataset.id, dataset.name);
                            }}
                            className="px-4 py-2 text-sm hover:bg-red-50 text-red-600 dark:hover:bg-red-900/10 text-left w-full relative z-50"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/datasets/new" className="w-full flex items-center gap-4 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Create Dataset</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Define your dataset structure</p>
              </div>
            </Link>
            <Link href="/datasets" className="w-full flex items-center gap-4 p-3 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">Manage Datasets</div>
                <div className="text-xs text-muted-foreground">View and edit your data</div>
              </div>
            </Link>
            <Link href="/datasets/import" className="w-full flex items-center gap-4 p-3 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Import CSV / Excel</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Upload and process your data</p>
              </div>
            </Link>
            <Link href="/experiments" className="w-full flex items-center gap-4 p-3 rounded-xl border border-border hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">View Experiments</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Check your ML experiments</p>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

