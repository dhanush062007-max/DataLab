"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Database, Grid, BrainCircuit, Calculator, BarChart3 as BarChartIcon, FileText, FlaskConical, Compass, ArrowRight, User, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Papa from "papaparse";
import dynamic from "next/dynamic";

const EDAOverview = dynamic(() => import("@/components/eda/EDAOverview").then(m => m.EDAOverview), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const StatisticalTesting = dynamic(() => import("@/components/stats/StatisticalTesting").then(m => m.StatisticalTesting), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ChartBuilder = dynamic(() => import("@/components/visualization/ChartBuilder").then(m => m.ChartBuilder), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ReportGenerator = dynamic(() => import("@/components/reports/ReportGenerator").then(m => m.ReportGenerator), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ExperimentLedger = dynamic(() => import("@/components/ml/ExperimentLedger").then(m => m.ExperimentLedger), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });

function ExploreDatasetContent() {
  const params = useParams();
  const datasetId = params.id as string;
  const router = useRouter();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "OVERVIEW";

  const [dataset, setDataset] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [publicForm, setPublicForm] = useState<any>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const handleDownloadCSV = async () => {
    if (!dataset) return;
    setDownloadingCsv(true);
    try {
      const allData: any[] = [];
      const chunkSize = 1000;
      let currentOffset = 0;

      while (true) {
        let query = supabase
          .from("dataset_records")
          .select("data")
          .eq("dataset_id", datasetId)
          .range(currentOffset, currentOffset + chunkSize - 1);
        
        if (dataset.active_version_id) {
          query = query.eq("version_id", dataset.active_version_id);
        } else {
          query = query.is("version_id", null);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        data.forEach(r => allData.push(r.data));
        
        if (data.length < chunkSize) break;
        currentOffset += data.length;
      }

      if (allData.length > 0) {
        const csv = Papa.unparse(allData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${dataset.name.replace(/\s+/g, '_')}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Error downloading CSV:", e);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Sync tab state with URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // Fetch Dataset (joined with profiles for the author name)
      const { data: dData, error: dError } = await supabase
        .from("datasets")
        .select(`
          *,
          profiles:owner_id (full_name)
        `)
        .eq("id", datasetId)
        .single();
        
      if (dError || dData.status !== "PUBLISHED") {
        console.error(dError || "Dataset not published");
        router.push("/");
        return;
      }
      setDataset(dData);

      // Fetch active public form if exists
      const { data: fData } = await supabase
        .from("collection_forms")
        .select("token")
        .eq("dataset_id", datasetId)
        .eq("visibility", "public")
        .eq("is_active", true)
        .maybeSingle();
      if (fData) setPublicForm(fData);

      // Fetch Columns
      const { data: cData } = await supabase
        .from("dataset_columns")
        .select("*")
        .eq("dataset_id", datasetId)
        .order("position", { ascending: true });
      
      if (cData) {
        setColumns(cData);
      }

      // Fetch sample records based on active version
      let rQuery = supabase
        .from("dataset_records")
        .select("id, data, created_at")
        .eq("dataset_id", datasetId)
        .order("created_at", { ascending: false })
        .limit(100);
        
      if (dData.active_version_id) {
        rQuery = rQuery.eq("version_id", dData.active_version_id);
      } else {
        rQuery = rQuery.is("version_id", null);
      }
        
      const { data: rData } = await rQuery;
      if (rData) setRecords(rData);
      
      setLoading(false);
    };

    fetchData();
  }, [datasetId, router]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center text-muted-foreground">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
      <div className="animate-pulse font-medium">Loading public dataset...</div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Background Gradients for Explore Page */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] opacity-50" />
      </div>
      {/* Navigation Header */}
      <nav className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Database className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">DataLab Explore</span>
            <span className="font-bold text-xl tracking-tight sm:hidden">Explore</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {session ? (
              <Link href="/dashboard">
                <Button variant="default" size="sm" className="rounded-full px-3 sm:px-6 text-xs sm:text-sm">
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
                  <Button variant="default" size="sm" className="rounded-full px-3 sm:px-6 shadow-sm text-xs sm:text-sm">
                    <span className="hidden sm:inline">Create Your Own Dataset</span>
                    <span className="sm:hidden">Get Started</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden flex flex-col pt-8 max-w-7xl mx-auto w-full px-4 md:px-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Link href="/#explore" className="hover:text-foreground transition-colors">Community Datasets</Link>
                <span>/</span>
                <span className="text-foreground">{dataset.name}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{dataset.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {publicForm && (
                  <Link href={`/f/${publicForm.token}`} target="_blank">
                    <Button variant="default" className="rounded-full px-6 flex items-center gap-2 shadow-sm hover:shadow-md transition-all">
                      <FlaskConical className="w-4 h-4" />
                      Submit Data to this Dataset
                    </Button>
                  </Link>
                )}
                <Button 
                  variant="outline" 
                  className="rounded-full px-6 flex items-center gap-2 bg-background border-border"
                  onClick={handleDownloadCSV}
                  disabled={downloadingCsv}
                >
                  {downloadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloadingCsv ? "Preparing Download..." : "Download CSV"}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" /> 
                Published by {dataset.profiles?.full_name || "Anonymous"}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-border overflow-x-auto hide-scrollbar whitespace-nowrap mb-6">
          <button 
            onClick={() => setActiveTab("OVERVIEW")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "OVERVIEW" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab("DATA")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "DATA" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Data
          </button>
          <button 
            onClick={() => setActiveTab("EDA")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "EDA" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Compass className="w-4 h-4" /> EDA
          </button>
          <button 
            onClick={() => setActiveTab("VISUALIZATION")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "VISUALIZATION" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <BarChartIcon className="w-4 h-4" /> Visualization
          </button>
          <button 
            onClick={() => setActiveTab("STATS")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "STATS" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Calculator className="w-4 h-4" /> Statistical Testing
          </button>
          <button 
            onClick={() => setActiveTab("ML")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "ML" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <BrainCircuit className="w-4 h-4" /> Machine Learning
          </button>
          <button 
            onClick={() => setActiveTab("EXPERIMENTS")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "EXPERIMENTS" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <FlaskConical className="w-4 h-4" /> Experiments
          </button>
          <button 
            onClick={() => setActiveTab("REPORT")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "REPORT" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="w-4 h-4" /> Report
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          
          {/* TAB: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6 overflow-y-auto pr-2 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                  <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-primary" /> Dataset Description</h3>
                    <p className="text-muted-foreground leading-relaxed">{dataset.description || "No description provided."}</p>
                  </div>
                  <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Grid className="w-5 h-5 text-primary" /> Schema Definition</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                          <tr>
                            <th className="px-5 py-3 font-semibold rounded-tl-lg">Column Name</th>
                            <th className="px-5 py-3 font-semibold rounded-tr-lg">Data Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {columns.map(col => (
                            <tr key={col.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-5 py-4 font-medium text-foreground">{col.display_name}</td>
                              <td className="px-5 py-4 text-muted-foreground">
                                <span className="px-2 py-1 bg-muted rounded text-xs font-mono">{col.data_type}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
                  <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none" />
                    <h3 className="text-xl font-bold mb-6">Statistics</h3>
                    <div className="space-y-5">
                      <div className="flex justify-between items-center pb-3 border-b border-border/40">
                        <span className="text-muted-foreground text-sm font-medium">Total Records</span>
                        <span className="font-bold text-lg">{dataset.row_count || 0}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-border/40">
                        <span className="text-muted-foreground text-sm font-medium">Total Columns</span>
                        <span className="font-bold text-lg">{columns.length}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-border/40">
                        <span className="text-muted-foreground text-sm font-medium">Source Type</span>
                        <span className="font-bold text-lg px-2 py-0.5 bg-primary/10 text-primary rounded">{dataset.source_type}</span>
                      </div>
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-muted-foreground text-sm font-medium">Published On</span>
                        <span className="font-semibold">{new Date(dataset.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EDA */}
          {activeTab === "EDA" && (
            <div className="overflow-y-auto pr-2 pb-4">
              <EDAOverview datasetId={datasetId} />
            </div>
          )}

          {/* TAB: DATA */}
          {activeTab === "DATA" && (
            <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden pb-12">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="font-semibold flex items-center gap-2">
                    <Grid className="w-5 h-5 text-primary" />
                    Data Explorer
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Showing {records.length} sample records</span>
                </div>
              </div>
              <div className="flex-1 overflow-auto relative">
                {records.length > 0 ? (
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm text-xs font-semibold text-muted-foreground uppercase border-b border-border z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 bg-muted/95 border-r border-border/50 text-center w-12">#</th>
                        {columns.map(col => (
                          <th key={col.id} className="px-4 py-3 border-r border-border/50">{col.display_name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {records.map((record, idx) => (
                        <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 bg-muted/10 text-muted-foreground text-center border-r border-border/50 text-xs">
                            {idx + 1}
                          </td>
                          {columns.map(col => (
                            <td key={col.id} className="px-4 py-2 border-r border-border/50">
                              {record.data[col.column_name] !== null && record.data[col.column_name] !== undefined
                                ? String(record.data[col.column_name])
                                : <span className="text-muted-foreground/30 italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <Grid className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-bold">No records found</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">This dataset is empty.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: VISUALIZATION */}
          {activeTab === "VISUALIZATION" && (
            <div className="overflow-y-auto pr-2 pb-12 h-full">
              <ChartBuilder datasetId={datasetId} columns={columns} />
            </div>
          )}

          {/* TAB: STATS */}
          {activeTab === "STATS" && (
            <div className="overflow-y-auto pr-2 pb-12 h-full">
              <StatisticalTesting datasetId={datasetId} columns={columns} />
            </div>
          )}

          {/* TAB: REPORT */}
          {activeTab === "REPORT" && (
            <div className="overflow-y-auto pr-2 pb-12 h-full">
              <ReportGenerator datasetId={datasetId} datasetName={dataset?.name || ""} />
            </div>
          )}

          {/* TAB: EXPERIMENTS */}
          {activeTab === "EXPERIMENTS" && (
            <div className="overflow-y-auto pr-2 pb-12 h-full">
              <ExperimentLedger datasetId={datasetId} />
            </div>
          )}

          {/* TAB: ML */}
          {activeTab === "ML" && (
            <div className="overflow-y-auto pr-2 pb-4 h-full">
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-xl shadow-sm">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                  <BrainCircuit className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Login Required for ML Training</h2>
                <p className="text-muted-foreground mb-6 max-w-md">Training machine learning models requires significant computational resources. Please sign in or create a free account to train custom models on this public dataset.</p>
                <Link href="/login">
                  <Button size="lg" className="rounded-full px-8">Sign in to DataLab</Button>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ExploreDatasetPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted-foreground">Loading...</div>}>
      <ExploreDatasetContent />
    </Suspense>
  );
}
