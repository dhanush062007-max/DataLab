"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Database, Upload, FileType, Columns, CheckCircle2, AlertCircle, Plus, Search, Grid, MoreVertical, Link as LinkIcon, Copy, Eye, PauseCircle, PlayCircle, Wand2, Compass, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Papa from "papaparse";
import Link from "next/link";
import dynamic from "next/dynamic";

const EDAOverview = dynamic(() => import("@/components/eda/EDAOverview").then(m => m.EDAOverview), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const DataCleaning = dynamic(() => import("@/components/eda/DataCleaning").then(m => m.DataCleaning), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ModelTrainer = dynamic(() => import("@/components/ml/ModelTrainer").then(m => m.ModelTrainer), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const StatisticalTesting = dynamic(() => import("@/components/stats/StatisticalTesting").then(m => m.StatisticalTesting), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ChartBuilder = dynamic(() => import("@/components/visualization/ChartBuilder").then(m => m.ChartBuilder), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ReportGenerator = dynamic(() => import("@/components/reports/ReportGenerator").then(m => m.ReportGenerator), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
const ExperimentLedger = dynamic(() => import("@/components/ml/ExperimentLedger").then(m => m.ExperimentLedger), { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground animate-pulse">Loading component...</div> });
import { BrainCircuit, Calculator, BarChart3 as BarChartIcon, FileText, FlaskConical } from "lucide-react";

function DatasetWorkspaceContent() {
  const params = useParams();
  const datasetId = params.id as string;
  const router = useRouter();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "DATA";

  const [dataset, setDataset] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Sync tab state with URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchColumn, setSearchColumn] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [appliedSearchColumn, setAppliedSearchColumn] = useState("");
  const [filteredCount, setFilteredCount] = useState<number | null>(null);

  // CSV Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Entry State
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [savingRow, setSavingRow] = useState(false);

  // Collection Form State
  const [form, setForm] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    const fetchData = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // Fetch Dataset
      const { data: dData, error: dError } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", datasetId)
        .single();
        
      if (dError) {
        console.error(dError);
        router.push("/datasets");
        return;
      }

      const owner = session?.user?.id === dData.owner_id;
      if (!owner) {
        // Redirect visitors to the dedicated public explore page
        router.push(`/explore/${datasetId}`);
        return;
      }

      setDataset(dData);
      setIsOwner(true);

      // Fetch Columns
      const { data: cData } = await supabase
        .from("dataset_columns")
        .select("*")
        .eq("dataset_id", datasetId)
        .order("position", { ascending: true });
      
      if (cData) {
        setColumns(cData);
        // Init row state
        const initialData: Record<string, any> = {};
        cData.forEach((col: any) => {
          initialData[col.column_name] = col.data_type === "BOOLEAN" ? false : "";
        });
        setNewRowData(initialData);
      }

      // Fetch Form if exists
      const { data: fData } = await supabase
        .from("collection_forms")
        .select("*")
        .eq("dataset_id", datasetId)
        .maybeSingle();

      if (fData) setForm(fData);
      
      setLoading(false);
    };

    fetchData();
  }, [datasetId, router]);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!dataset) return;
      
      const from = (currentPage - 1) * recordsPerPage;
      const to = from + recordsPerPage - 1;

      let rQuery = supabase
        .from("dataset_records")
        .select("id, data, created_at", { count: "exact" })
        .eq("dataset_id", datasetId)
        .order("created_at", { ascending: false })
        .range(from, to);
        
      if (dataset.active_version_id) {
        rQuery = rQuery.eq("version_id", dataset.active_version_id);
      } else {
        rQuery = rQuery.is("version_id", null);
      }

      if (appliedSearchTerm && appliedSearchColumn) {
        rQuery = rQuery.ilike(`data->>${appliedSearchColumn}`, `%${appliedSearchTerm}%`);
      }
        
      const { data: rData, count } = await rQuery;
      if (rData) setRecords(rData);
      if (count !== null) setFilteredCount(count);
    };

    fetchRecords();
  }, [dataset, currentPage, datasetId, appliedSearchTerm, appliedSearchColumn]);

  const handleSearch = () => {
    if (!searchColumn) return;
    setAppliedSearchColumn(searchColumn);
    setAppliedSearchTerm(searchTerm);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchColumn("");
    setAppliedSearchTerm("");
    setAppliedSearchColumn("");
    setCurrentPage(1);
    setFilteredCount(null);
  };

  // Handle CSV Upload via PapaParse Web Worker
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error(`CSV Parsing Error: ${results.errors[0].message}`);
          }
          setUploadProgress(40);

          const parsedData = results.data;
          if (parsedData.length === 0) throw new Error("The uploaded CSV is empty.");

          // Validate headers (basic check if CSV matches our schema at least somewhat)
          const csvHeaders = Object.keys(parsedData[0] as object);
          const expectedHeaders = columns.map(c => c.column_name);
          
          const missingRequired = columns.filter(c => c.required && !csvHeaders.includes(c.column_name));
          if (missingRequired.length > 0) {
            throw new Error(`CSV is missing required columns: ${missingRequired.map(c => c.column_name).join(", ")}`);
          }
          
          setUploadProgress(60);

          setUploadProgress(50);

          // We will batch insert to handle massive CSVs without timing out
          const BATCH_SIZE = 5000;
          let totalInserted = 0;

          for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
            const chunk = parsedData.slice(i, i + BATCH_SIZE);
            const recordsToInsert = chunk.map((row: any) => {
              // Clean row based on schema
              const cleanRow: Record<string, any> = {};
              columns.forEach(col => {
                let val = row[col.column_name];
                if (val !== undefined && val !== "") {
                  if (col.data_type === "INTEGER" || col.data_type === "DECIMAL") val = Number(val);
                  if (col.data_type === "BOOLEAN") val = String(val).toLowerCase() === "true" || val === "1";
                  cleanRow[col.column_name] = val;
                } else {
                  cleanRow[col.column_name] = null;
                }
              });
              return {
                dataset_id: datasetId,
                data: cleanRow
              };
            });

            const { error } = await supabase
              .from("dataset_records")
              .insert(recordsToInsert);

            if (error) throw error;

            totalInserted += recordsToInsert.length;
            
            // Calculate progress between 50% and 90%
            const progress = 50 + Math.floor((totalInserted / parsedData.length) * 40);
            setUploadProgress(progress);
          }

          // Update Dataset count
          await supabase
            .from("datasets")
            .update({ row_count: (dataset.row_count || 0) + totalInserted, status: "READY" })
            .eq("id", datasetId);
            
          // Trigger Semantic Profiling on the Backend
          try {
            const { data: authData } = await supabase.auth.getSession();
            const token = authData.session?.access_token;
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/profile`, {
              method: 'POST',
              headers
            });
          } catch (e) {
            console.error("Failed to run profiling:", e);
          }

          setUploadProgress(100);
          setUploading(false);
          setUploadSuccess(`Successfully uploaded ${totalInserted} records!`);
          
          // Refresh data
          const { data: updatedDataset } = await supabase.from("datasets").select("*").eq("id", datasetId).single();
          if (updatedDataset) setDataset(updatedDataset);
          setCurrentPage(1);
          setFilteredCount(null);

        } catch (err: any) {
          setUploadError(err.message || "An error occurred during upload.");
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setUploadError(error.message);
        setUploading(false);
      }
    });
  };

  // Handle Manual Row Add
  const handleAddRow = async () => {
    setSavingRow(true);
    setUploadError(null);
    try {
      // Validate
      for (const col of columns) {
        if (col.required && (newRowData[col.column_name] === "" || newRowData[col.column_name] === null)) {
          throw new Error(`Field '${col.display_name}' is required.`);
        }
      }

      const { data, error } = await supabase
        .from("dataset_records")
        .insert({ 
          dataset_id: datasetId, 
          data: newRowData,
          version_id: dataset.active_version_id || null
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("datasets")
        .update({ row_count: (dataset.row_count || 0) + 1, status: "READY" })
        .eq("id", datasetId);

      setRecords([data, ...records]);
      setShowAddRow(false);
      
      // Reset form
      const initialData: Record<string, any> = {};
      columns.forEach((col: any) => {
        initialData[col.column_name] = col.data_type === "BOOLEAN" ? false : "";
      });
      setNewRowData(initialData);

    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setSavingRow(false);
    }
  };

  const generateForm = async () => {
    setGenerating(true);
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data, error } = await supabase
      .from("collection_forms")
      .insert({ dataset_id: datasetId, token: token, is_active: true })
      .select()
      .single();

    if (!error && data) setForm(data);
    setGenerating(false);
  };

  const toggleFormStatus = async () => {
    if (!form) return;
    const newStatus = !form.is_active;
    const { error } = await supabase
      .from("collection_forms")
      .update({ is_active: newStatus })
      .eq("id", form.id);
    if (!error) setForm({ ...form, is_active: newStatus });
  };

  const updateRateLimit = async (maxPerMinute: number) => {
    if (!form) return;
    const newSettings = { ...form.rate_limit_settings, max_per_minute: maxPerMinute };
    const { error } = await supabase
      .from("collection_forms")
      .update({ rate_limit_settings: newSettings })
      .eq("id", form.id);
    if (!error) setForm({ ...form, rate_limit_settings: newSettings });
  };

  const updateVisibility = async (newVisibility: string) => {
    if (!form) return;
    const { error } = await supabase
      .from("collection_forms")
      .update({ visibility: newVisibility })
      .eq("id", form.id);
    if (!error) setForm({ ...form, visibility: newVisibility });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/f/${form.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    const { error } = await supabase
      .from("datasets")
      .update({ status: newStatus })
      .eq("id", datasetId);
      
    if (!error) {
      setDataset({ ...dataset, status: newStatus });
    } else {
      console.error("Error updating status:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
      case "PUBLISHED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      default:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
  };



  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading workspace...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link href="/datasets" className="hover:text-foreground transition-colors">Datasets</Link>
              <span>/</span>
              <span className="text-foreground">{dataset.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{dataset.name}</h1>
          </div>
          <div className="flex gap-2 items-center">
            {isOwner ? (
              <select
                value={dataset.status || "NOT READY"}
                onChange={handleStatusChange}
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest outline-none cursor-pointer border appearance-none text-center ${getStatusColor(dataset.status)}`}
              >
                <option value="NOT READY">NOT READY</option>
                <option value="READY">READY</option>
                <option value="PUBLISHED">PUBLISHED</option>
              </select>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border text-center ${getStatusColor(dataset.status)}`}>
                {dataset.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border overflow-x-auto hide-scrollbar whitespace-nowrap">
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
          onClick={() => setActiveTab("COLLECTION")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "COLLECTION" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Collection Form
        </button>
        <button 
          onClick={() => setActiveTab("CLEANING")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === "CLEANING" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Wand2 className="w-4 h-4" /> Cleaning
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
              
              <div className="md:col-span-2 space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-2">Dataset Description</h3>
                  <p className="text-muted-foreground">{dataset.description || "No description provided."}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Schema Definition</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                        <tr>
                          <th className="px-4 py-2 font-medium">Column Name</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {columns.map(col => (
                          <tr key={col.id}>
                            <td className="px-4 py-3 font-medium">{col.display_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {col.semantic_type && col.semantic_type !== 'UNKNOWN' ? col.semantic_type.replace(/_/g, ' ') : col.data_type}
                            </td>
                            <td className="px-4 py-3">
                              {col.required ? <span className="text-red-500 font-bold">*</span> : <span className="text-muted-foreground">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Statistics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Total Records</span>
                      <span className="font-semibold">{dataset.row_count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Total Columns</span>
                      <span className="font-semibold">{columns.length}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Source Type</span>
                      <span className="font-semibold">{dataset.source_type}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Created</span>
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
          <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20">
              <div className="flex items-center justify-between gap-3 w-full sm:w-auto sm:justify-start">
                <div className="font-semibold flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary" />
                  Data Explorer
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                  {records.length > 0 ? `${(currentPage - 1) * recordsPerPage + 1}-${Math.min(currentPage * recordsPerPage, (filteredCount ?? dataset?.row_count) || 0)} of ${(filteredCount ?? dataset?.row_count) || 0}` : `0 of ${(filteredCount ?? dataset?.row_count) || 0}`}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                {/* Search Box */}
                <div className="flex items-center gap-2 w-full sm:w-auto sm:mr-2">
                  <select 
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1 w-[110px] sm:w-auto truncate shrink-0"
                    value={searchColumn}
                    onChange={(e) => setSearchColumn(e.target.value)}
                  >
                    <option value="">All Columns</option>
                    {columns.map(c => <option key={c.column_name} value={c.column_name}>{c.display_name || c.column_name}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Search..."
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1 flex-1 min-w-0 sm:w-32"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  {appliedSearchTerm ? (
                    <Button onClick={handleClearSearch} variant="ghost" size="sm" className="h-8 px-2 text-xs shrink-0">Clear</Button>
                  ) : (
                    <Button onClick={handleSearch} variant="secondary" size="sm" className="h-8 px-2 text-xs shrink-0">
                      <Search className="w-3 h-3 sm:mr-1" /> <span className="hidden sm:inline">Search</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:mr-2">
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                    disabled={currentPage === 1} 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                  >
                    Prev
                  </Button>
                  <span className="text-xs font-medium px-2">Page {currentPage}</span>
                  <Button 
                    onClick={() => setCurrentPage(prev => prev + 1)} 
                    disabled={currentPage * recordsPerPage >= (filteredCount ?? dataset?.row_count ?? 0)} 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                  >
                    Next
                  </Button>
                </div>
                <Button onClick={handleDownloadCSV} disabled={downloadingCsv} variant="outline" size="sm" className="flex items-center gap-2">
                  {downloadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloadingCsv ? "Exporting..." : "Export CSV"}
                </Button>
                {isOwner && (
                  <Button onClick={() => setShowAddRow(!showAddRow)} size="sm" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Row
                  </Button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="m-4 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
                {uploadError}
              </div>
            )}

            {/* Manual Entry Panel */}
            {showAddRow && (
              <div className="p-4 bg-muted/30 border-b border-border">
                <div className="font-bold text-sm mb-3">Add New Record</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {columns.map(col => (
                    <div key={col.id} className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{col.display_name} {col.required && "*"}</label>
                      
                      {col.data_type === "BOOLEAN" || col.semantic_type === "BOOLEAN" ? (
                        <input 
                          type="checkbox" 
                          checked={newRowData[col.column_name] || false}
                          onChange={(e) => setNewRowData({...newRowData, [col.column_name]: e.target.checked})}
                          className="block mt-2 w-4 h-4 text-primary"
                        />
                      ) : col.data_type === "INTEGER" || col.data_type === "DECIMAL" || col.semantic_type === "INTEGER" || col.semantic_type === "DECIMAL" ? (
                        <input 
                          type="number" 
                          value={newRowData[col.column_name] || ""}
                          onChange={(e) => setNewRowData({...newRowData, [col.column_name]: e.target.value === "" ? "" : Number(e.target.value)})}
                          className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm outline-none focus:border-primary"
                        />
                      ) : ["SINGLE_CHOICE", "ORDINAL_CHOICE", "CATEGORY"].includes(col.semantic_type) ? (
                        <select 
                          value={newRowData[col.column_name] || ""}
                          onChange={(e) => setNewRowData({...newRowData, [col.column_name]: e.target.value})}
                          className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm outline-none focus:border-primary"
                        >
                          <option value="" disabled>Select option</option>
                          {(col.options || []).map((opt: string, idx: number) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                          {(!col.options || col.options.length === 0) && <option value="" disabled>No options available</option>}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          value={newRowData[col.column_name] || ""}
                          onChange={(e) => setNewRowData({...newRowData, [col.column_name]: e.target.value})}
                          className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm outline-none focus:border-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleAddRow} size="sm" disabled={savingRow}>
                    {savingRow ? "Saving..." : "Save Record"}
                  </Button>
                  <Button onClick={() => setShowAddRow(false)} variant="outline" size="sm">Cancel</Button>
                </div>
              </div>
            )}

            {/* Data Area */}
            <div className="flex-1 overflow-auto relative">
              
              {/* Show Upload Dropzone if dataset is empty and type is CSV */}
              {records.length === 0 && dataset.source_type === "CSV" && !uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/10">
                  <div className="max-w-md w-full p-8 border-2 border-dashed border-primary/40 rounded-2xl text-center bg-background">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Upload CSV File</h3>
                    <p className="text-muted-foreground text-sm mb-6">Your dataset is currently empty. Upload a CSV file matching your schema to populate the data.</p>
                    
                    <input 
                      type="file" 
                      accept=".csv" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2">
                      Select CSV File
                    </label>
                  </div>
                </div>
              )}

              {/* Show Loading State */}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                  <div className="w-64 space-y-4 text-center">
                    <div className="font-bold">Processing CSV Data...</div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <div className="text-sm text-muted-foreground">{uploadProgress}% Complete</div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {uploadSuccess && (
                <div className="m-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setUploadSuccess(null)} className="h-8 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">Dismiss</Button>
                </div>
              )}

              {/* Data Table */}
              {records.length > 0 && (
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm text-xs font-semibold text-muted-foreground uppercase border-b border-border z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 bg-muted/95 border-r border-border/50 text-center w-12">#</th>
                      {columns.map(col => (
                        <th key={col.id} className="px-4 py-3 border-r border-border/50">{col.display_name}</th>
                      ))}
                      <th className="px-4 py-3"></th>
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
                        <td className="px-4 py-2 text-right">
                          {isOwner && (
                            <button className="text-muted-foreground hover:text-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Empty state for Manual */}
              {records.length === 0 && dataset.source_type !== "CSV" && !showAddRow && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <Grid className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-bold">No data yet</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm">This dataset is currently empty. Use the "Add Row" button above to insert your first record manually.</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB: COLLECTION FORM */}
        {activeTab === "COLLECTION" && (
          <div className="overflow-y-auto pr-2 pb-4">
            {!form ? (
              <div className="bg-card border border-border rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                  <LinkIcon className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">No form generated yet</h2>
                <p className="text-muted-foreground mb-8 max-w-md">Create a public collection form to start gathering responses. Anyone with the link will be able to submit data based on your schema.</p>
                <Button onClick={generateForm} size="lg" disabled={generating} className="flex items-center gap-2">
                  {generating ? "Generating..." : <><Plus className="w-5 h-5" />Generate Form Link</>}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                      <div>
                        <h2 className="text-lg font-bold flex flex-wrap items-center gap-2">
                          Public Share Link
                          {form.is_active ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">Inactive</span>
                          )}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Share this URL with your respondents.</p>
                      </div>
                      <Link href={`/f/${form.token}`} target="_blank">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Preview
                        </Button>
                      </Link>
                    </div>

                    <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border border-border">
                      <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/f/${form.token}`} 
                        className="flex-1 min-w-0 bg-transparent border-none text-sm font-medium focus:ring-0 outline-none px-2 text-foreground"
                      />
                      <Button onClick={copyLink} variant={copied ? "default" : "secondary"} className={`shrink-0 ${copied ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
                        {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Copied!" : "Copy Link"}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-bold mb-4">Form Settings</h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-border">
                      <div className="min-w-0">
                        <div className="font-medium">Form Status</div>
                        <div className="text-sm text-muted-foreground">Turn off to prevent new submissions.</div>
                      </div>
                      <Button onClick={toggleFormStatus} variant={form.is_active ? "destructive" : "default"} className="w-full sm:w-32 shrink-0">
                        {form.is_active ? <><PauseCircle className="w-4 h-4 mr-2"/> Deactivate</> : <><PlayCircle className="w-4 h-4 mr-2"/> Activate</>}
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-b border-border">
                      <div className="min-w-0">
                        <div className="font-medium">Visibility</div>
                        <div className="text-sm text-muted-foreground">Control who can find and access this form.</div>
                      </div>
                      <select 
                        value={form.visibility || 'private'}
                        onChange={(e) => updateVisibility(e.target.value)}
                        className="w-full sm:w-auto h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus:border-primary shrink-0"
                      >
                        <option value="public">Public (Shown on Explore Page)</option>
                        <option value="private">Private (Link Only)</option>
                        <option value="only_me">Only Me (Closed)</option>
                      </select>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <div className="font-medium">Rate Limiting (Browser-based)</div>
                        <div className="text-sm text-muted-foreground">Max submissions per minute from the same device.</div>
                      </div>
                      <select 
                        value={form.rate_limit_settings?.max_per_minute ?? 5}
                        onChange={(e) => updateRateLimit(Number(e.target.value))}
                        className="w-full sm:w-auto h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus:border-primary shrink-0"
                      >
                        <option value={0}>Only once (Ever)</option>
                        <option value={1}>1 per minute</option>
                        <option value={5}>5 per minute</option>
                        <option value={10}>10 per minute</option>
                        <option value={50}>50 per minute</option>
                        <option value={100}>100 per minute</option>
                        <option value={999999}>Unlimited</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-primary">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="w-5 h-5" />
                      <h3 className="font-bold">Security Notice</h3>
                    </div>
                    <p className="text-sm leading-relaxed opacity-90">
                      Anyone with this link can submit data to your dataset. Submissions are inserted directly into your database using a secure Row Level Security bypass function.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: CLEANING */}
        {activeTab === "CLEANING" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            {!isOwner ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-xl">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
                  <Wand2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold mb-2">Read-Only View</h2>
                <p className="text-muted-foreground mb-6 max-w-md">Data cleaning operations are restricted to the dataset owner to prevent unauthorized modifications.</p>
              </div>
            ) : (
              <DataCleaning 
                datasetId={datasetId} 
                columns={columns} 
                onCleanSuccess={() => {
                  // Silently refresh the dataset in the background so the new version is loaded
                  // without forcing a full page reload, allowing the user to see the success message.
                  supabase.from("datasets").select("*").eq("id", datasetId).single().then(({data}) => {
                    if (data) {
                      setDataset(data);
                      setFilteredCount(null);
                      setCurrentPage(1);
                    }
                  });
                }} 
              />
            )}
          </div>
        )}

        {/* TAB: ML */}
        {activeTab === "ML" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            {!session ? (
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
            ) : (
              <ModelTrainer datasetId={datasetId} columns={columns} />
            )}
          </div>
        )}

        {/* TAB: EXPERIMENTS */}
        {activeTab === "EXPERIMENTS" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            <ExperimentLedger datasetId={datasetId} />
          </div>
        )}

        {/* TAB: VISUALIZATION */}
        {activeTab === "VISUALIZATION" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            <ChartBuilder datasetId={datasetId} columns={columns} />
          </div>
        )}

        {/* TAB: STATS */}
        {activeTab === "STATS" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            <StatisticalTesting datasetId={datasetId} columns={columns} />
          </div>
        )}

        {/* TAB: REPORT */}
        {activeTab === "REPORT" && (
          <div className="overflow-y-auto pr-2 pb-4 h-full">
            <ReportGenerator datasetId={datasetId} datasetName={dataset?.name || "Dataset Report"} />
          </div>
        )}

      </div>
    </div>
  );
}

export default function DatasetWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted-foreground">Loading...</div>}>
      <DatasetWorkspaceContent />
    </Suspense>
  );
}
