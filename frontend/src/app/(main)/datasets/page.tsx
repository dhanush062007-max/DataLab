"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Database, Plus, Search, MoreVertical, Filter, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    const fetchDatasets = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("datasets")
        .select("*, collection_forms(id, is_active)")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDatasets(data);
      }
      setLoading(false);
    };

    fetchDatasets();
  }, [router]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((ds) => {
      const matchesSearch = ds.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (ds.description && ds.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = filterType === "all" || ds.source_type === filterType || ds.status === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [datasets, searchQuery, filterType]);

  const handleExport = () => {
    if (filteredDatasets.length === 0) return;
    
    // Simple CSV export of the datasets list
    const headers = ["Dataset Name", "Source Type", "Status", "Row Count", "Created At"];
    const csvContent = [
      headers.join(","),
      ...filteredDatasets.map(ds => [
        `"${ds.name}"`, 
        `"${ds.source_type}"`, 
        `"${ds.status}"`, 
        ds.row_count || 0, 
        ds.created_at
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "datasets_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the dataset "${name}"? This action cannot be undone and will delete all associated models and reports.`)) return;

    try {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
      
      // Update local state to remove the deleted dataset
      setDatasets(datasets.filter(ds => ds.id !== id));
    } catch (err: any) {
      alert(`Failed to delete dataset: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Datasets
          </h1>
          <p className="text-muted-foreground mt-1">Manage your connected data sources and collected datasets.</p>
        </div>
        <Link href="/datasets/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Dataset
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search datasets by name or description..." 
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="all">All Types & Status</option>
                <option value="CSV">CSV</option>
                <option value="DB">Database</option>
                <option value="API">API</option>
                <option value="READY">Ready</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            
            <Button onClick={handleExport} variant="outline" size="sm" className="flex items-center gap-2 h-10 flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Data List */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading datasets...</div>
        ) : datasets.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Database className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">No datasets found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">You haven&apos;t created or imported any datasets yet. Get started by creating your first dataset.</p>
            <Link href="/datasets/new">
              <Button>Create Dataset</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Dataset Name</th>
                  <th className="px-6 py-3 font-medium">Source Type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Size</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDatasets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No datasets match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDatasets.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/datasets/${dataset.id}`} className="font-semibold text-foreground hover:text-primary transition-colors hover:underline">
                          {dataset.name}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{dataset.description || "No description"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {dataset.source_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {dataset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {dataset.row_count || 0} rows <br />
                        <span className="text-xs">{dataset.column_count || 0} cols</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(dataset.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/datasets/${dataset.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                              Open Dataset
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(dataset.id, dataset.name)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                            title="Delete Dataset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
