"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { History, GitCommit, Play, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VersionHistoryProps {
  datasetId: string;
  currentActiveVersion: string | null;
  onVersionRestored: () => void;
}

export function VersionHistory({ datasetId, currentActiveVersion, onVersionRestored }: VersionHistoryProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [datasetId, currentActiveVersion]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("dataset_versions")
        .select(`
          id,
          operation,
          parameters,
          created_at,
          profiles:created_by (full_name)
        `)
        .eq("dataset_id", datasetId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setVersions(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string | null) => {
    if (!confirm("Are you sure you want to restore this version? This will update the active data for everyone.")) return;
    
    try {
      setRestoring(versionId || "original");
      const { error } = await supabase
        .from("datasets")
        .update({ active_version_id: versionId })
        .eq("id", datasetId);

      if (error) throw error;
      onVersionRestored();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-border bg-muted/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Version History</h2>
            <p className="text-sm text-muted-foreground">View all snapshots of this dataset and restore previous states.</p>
          </div>
        </div>
        
        {error && (
          <div className="p-4 m-6 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-200 dark:border-red-900/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="p-6">
          <div className="relative border-l-2 border-muted ml-4 space-y-8 pb-4">
            
            {/* V0 - Original Data */}
            <div className="relative pl-8">
              <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${currentActiveVersion === null ? 'bg-primary border-primary' : 'bg-background border-muted-foreground'}`}></div>
              <div className={`p-4 border rounded-xl shadow-sm transition-all ${currentActiveVersion === null ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card'}`}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">V0</span>
                      <h3 className="font-bold text-lg">Original Dataset</h3>
                      {currentActiveVersion === null && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400">ACTIVE</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">The initial raw data uploaded or imported.</p>
                  </div>
                  {currentActiveVersion !== null && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleRestoreVersion(null)}
                      disabled={restoring !== null}
                    >
                      {restoring === "original" ? "Restoring..." : "Restore"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Revisions */}
            {versions.map((v, idx) => {
              const isActive = currentActiveVersion === v.id;
              
              return (
                <div key={v.id} className="relative pl-8">
                  <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${isActive ? 'bg-primary border-primary' : 'bg-background border-muted-foreground'}`}></div>
                  
                  <div className={`p-4 border rounded-xl shadow-sm transition-all ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:bg-muted/30'}`}>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">V{idx + 1}</span>
                          <h3 className="font-bold text-lg flex items-center gap-2">
                            <GitCommit className="w-4 h-4 text-muted-foreground" />
                            {v.operation}
                          </h3>
                          {isActive && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400">ACTIVE</span>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(v.created_at).toLocaleString()}
                          </div>
                          <div>By {v.profiles?.full_name || "AI Assistant"}</div>
                        </div>
                        
                        {v.parameters && Object.keys(v.parameters).length > 0 && (
                          <div className="bg-background/50 rounded-md p-2 text-xs font-mono text-muted-foreground border border-border">
                            {JSON.stringify(v.parameters)}
                          </div>
                        )}
                      </div>
                      
                      {!isActive && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRestoreVersion(v.id)}
                          disabled={restoring !== null}
                        >
                          {restoring === v.id ? "Restoring..." : "Restore"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>
    </div>
  );
}
