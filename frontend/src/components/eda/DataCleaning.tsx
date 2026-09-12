import { useState } from "react";
import { Database, Wand2, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataQualityDashboard } from "./DataQualityDashboard";

export function DataCleaning({ datasetId, columns, onCleanSuccess }: { datasetId: string, columns: any[], onCleanSuccess: () => void }) {
  const [operation, setOperation] = useState("DROP_NULLS");
  const [targetColumn, setTargetColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClean = async () => {
    setLoading(true);
    setLoadingSlow(false);
    setError(null);
    setResult(null);

    const slowTimer = setTimeout(() => {
      setLoadingSlow(true);
    }, 5000);

    const payload: any = {
      operation
    };

    if (operation === "FILL_MEAN") {
      if (!targetColumn) {
        setError("Please select a target column to fill missing values.");
        setLoading(false);
        clearTimeout(slowTimer);
        return;
      }
      payload.parameters = { column: targetColumn };
    } else if (operation === "DROP_DUPLICATES") {
      if (targetColumn) {
        payload.parameters = { columns: [targetColumn] };
      }
    }

    try {
      const { data: authData } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      const token = authData.session?.access_token;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/clean`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Cleaning failed");
      }
      
      setResult(data);
      onCleanSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadingSlow(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <DataQualityDashboard datasetId={datasetId} />
      
      <div className="bg-card border border-border rounded-xl shadow-sm p-8">
        
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <Wand2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Data Cleaning Studio</h2>
            <p className="text-muted-foreground text-sm">Transform your dataset using powerful Pandas operations. Your original data is safely versioned.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold">{result.message}</div>
              {result.row_count && <div className="mt-1 opacity-90">Dataset now contains {result.row_count} rows.</div>}
            </div>
          </div>
        )}

        {loadingSlow && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
            <div>
              <div className="font-bold">Processing a large dataset</div>
              <div className="mt-1 opacity-90">Our backend is churning through thousands of rows out-of-core. This might take a few seconds...</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold">Select Operation</label>
              <div className="grid gap-3">
                
                <div 
                  onClick={() => { setOperation("DROP_NULLS"); setTargetColumn(""); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${operation === "DROP_NULLS" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className="font-bold text-sm">Drop Missing Values</div>
                  <div className="text-xs text-muted-foreground mt-1">Remove all rows containing missing (null) values.</div>
                </div>
                
                <div 
                  onClick={() => { setOperation("FILL_MEAN"); setTargetColumn(""); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${operation === "FILL_MEAN" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className="font-bold text-sm">Fill with Mean</div>
                  <div className="text-xs text-muted-foreground mt-1">Replace missing values in a numeric column with its average.</div>
                </div>

                <div 
                  onClick={() => { setOperation("DROP_DUPLICATES"); setTargetColumn(""); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${operation === "DROP_DUPLICATES" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className="font-bold text-sm">Remove Duplicates</div>
                  <div className="text-xs text-muted-foreground mt-1">Drop rows that are exact duplicates of another row.</div>
                </div>

              </div>
            </div>
          </div>

          <div className="space-y-6 bg-muted/30 p-6 rounded-xl border border-border">
            <h3 className="font-bold text-lg border-b border-border pb-3">Parameters</h3>
            
            {operation === "DROP_NULLS" && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                This operation will scan the entire dataset and permanently remove any row that has a missing value in any required column. Because versions are tracked, you can always revert to the raw data later.
              </p>
            )}

            {operation === "DROP_DUPLICATES" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This operation will identify and remove any rows where every single column matches exactly with another row, keeping only the first occurrence. 
                  Alternatively, select a specific column below to identify duplicates based ONLY on that column.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Target Column (Optional)</label>
                  <select 
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="">-- All Columns (Exact Row Match) --</option>
                    {columns.map(c => (
                      <option key={c.id} value={c.column_name}>{c.display_name || c.column_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {operation === "FILL_MEAN" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select the numeric column where missing values should be replaced by the mean average of that column.</p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Target Column</label>
                  <select 
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="">-- Select Column --</option>
                    {columns.filter(c => c.data_type === "INTEGER" || c.data_type === "DECIMAL").map(c => (
                      <option key={c.id} value={c.column_name}>{c.display_name} ({c.data_type})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="pt-6 mt-6 border-t border-border">
              <Button onClick={handleClean} disabled={loading} className="w-full flex items-center justify-center gap-2" size="lg">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                {loading ? "Running Pandas Engine..." : "Execute Cleaning"}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
