"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FlaskConical, Target, BrainCircuit, Calendar, Loader2 } from "lucide-react";

interface ExperimentLedgerProps {
  datasetId: string;
}

export function ExperimentLedger({ datasetId }: ExperimentLedgerProps) {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExperiments() {
      setLoading(true);
      const { data } = await supabase
        .from("ml_experiments")
        .select("*")
        .eq("dataset_id", datasetId)
        .order("created_at", { ascending: false });
      
      if (data) setExperiments(data);
      setLoading(false);
    }
    fetchExperiments();
  }, [datasetId]);

  if (loading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Loading past experiments...</p>
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
        <FlaskConical className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-semibold mb-2">No Experiments Found</h3>
        <p>You haven't trained any machine learning models on this dataset yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <FlaskConical className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Experiment Leaderboard</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experiments.map((exp) => {
          const isClassification = exp.algorithm && (exp.algorithm.includes("CLASSIFIER") || exp.algorithm.includes("LOGISTIC"));
          
          return (
            <div key={exp.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg truncate" title={exp.model_name || exp.model_type}>
                    {exp.model_name || exp.model_type}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(exp.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`shrink-0 whitespace-nowrap text-xs px-2 py-1 rounded-full font-semibold ${isClassification ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                  {isClassification ? 'Classification' : 'Regression'}
                </span>
              </div>

              <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                  <Target className="w-4 h-4" /> Target Variable
                </div>
                <div className="font-semibold truncate">
                  {exp.target_column}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {isClassification ? (
                  <>
                    <div className="border border-border rounded-lg p-3 text-center bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Accuracy</div>
                      <div className="text-lg font-black text-primary">{(exp.metrics.accuracy * 100).toFixed(1)}%</div>
                    </div>
                    <div className="border border-border rounded-lg p-3 text-center bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">F1 Score</div>
                      <div className="text-lg font-black text-primary">{(exp.metrics.f1_score * 100).toFixed(1)}%</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border border-border rounded-lg p-3 text-center bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">R² Score</div>
                      <div className="text-lg font-black text-primary">{exp.metrics?.r2?.toFixed(3)}</div>
                    </div>
                    <div className="border border-border rounded-lg p-3 text-center bg-card">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">MSE</div>
                      <div className="text-lg font-black text-primary">{exp.metrics?.mse?.toFixed(3)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
