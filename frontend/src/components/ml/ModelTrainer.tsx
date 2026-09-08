"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BrainCircuit, Play, CheckCircle2, AlertCircle, BarChart3, TrendingUp, Settings, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelTrainerProps {
  datasetId: string;
  columns: any[];
}

export function ModelTrainer({ datasetId, columns }: ModelTrainerProps) {
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [featureColumns, setFeatureColumns] = useState<string[]>([]);
  const [algorithm, setAlgorithm] = useState<string>("RANDOM_FOREST_REGRESSOR");
  const [training, setTraining] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (columns && columns.length > 0) {
      // Find default target
      const defaultTarget = columns.find(c => c.ml_role === 'TARGET')?.column_name;
      if (defaultTarget && !targetColumn) {
        setTargetColumn(defaultTarget);
      }
      
      // Find default features
      if (featureColumns.length === 0) {
        const defaultFeatures = columns
          .filter(c => c.ml_role === 'FEATURE' || (c.ml_role !== 'IGNORE' && c.ml_role !== 'TARGET' && c.column_name !== defaultTarget))
          .map(c => c.column_name);
        setFeatureColumns(defaultFeatures);
      }
    }
  }, [columns]);

  // When target changes, ensure it's not in features
  useEffect(() => {
    if (targetColumn && featureColumns.includes(targetColumn)) {
      setFeatureColumns(prev => prev.filter(c => c !== targetColumn));
    }
  }, [targetColumn]);

  const toggleFeature = (colName: string) => {
    if (featureColumns.includes(colName)) {
      setFeatureColumns(featureColumns.filter(c => c !== colName));
    } else {
      setFeatureColumns([...featureColumns, colName]);
    }
  };

  const handleTrain = async () => {
    if (!targetColumn) {
      setError("Please select a target variable to predict.");
      return;
    }
    const finalFeatures = featureColumns.filter(c => c !== targetColumn);
    if (finalFeatures.length === 0) {
      setError("Please select at least one feature variable.");
      return;
    }

    setTraining(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          model_name: `Model predicting ${targetColumn}`,
          target_column: targetColumn,
          feature_columns: finalFeatures,
          algorithm: algorithm
        })
      });

      const data = await res.json();
      if (res.status === 429) throw new Error("Model Limit exceeded. Please wait a minute before training again.");
      if (!res.ok) throw new Error(data.detail || data.error || "Training failed");

      // Save to Supabase
      const payload = { 
        ...data, 
        id: crypto.randomUUID(),
        owner_id: session.user.id 
      };

      const { error: insertError } = await supabase
        .from("ml_experiments")
        .insert(payload);
        
      if (insertError) {
        console.error("Failed to save experiment to DB:", JSON.stringify(insertError));
        setError("Database Insert Error: " + (insertError.message || JSON.stringify(insertError)));
        setResult(data); 
      } else {
        alert("Experiment successfully saved to database!");
        setResult(data);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Configuration */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Model Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Target Variable (What to predict)</label>
              <select 
                className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
              >
                <option value="">-- Select Target --</option>
                {columns.filter(c => c.ml_role !== 'IGNORE').map(col => (
                  <option key={col.id} value={col.column_name}>
                    {col.display_name || col.column_name} ({col.semantic_type === 'UNKNOWN' ? col.data_type : (col.semantic_type || col.data_type)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Algorithm</label>
              <select 
                className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                value={algorithm}
                onChange={e => setAlgorithm(e.target.value)}
              >
                <option value="RANDOM_FOREST_REGRESSOR">Random Forest (Regression)</option>
                <option value="RANDOM_FOREST_CLASSIFIER">Random Forest (Classification)</option>
                <option value="LINEAR_REGRESSION">Linear Regression</option>
                <option value="LOGISTIC_REGRESSION">Logistic Regression</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 flex justify-between items-center">
                <span>Features (Input variables)</span>
                <span className="text-xs font-normal text-muted-foreground">{featureColumns.length} selected</span>
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 bg-background border border-border rounded-md p-2">
                {columns.map(col => {
                  const isTarget = col.column_name === targetColumn;
                  const isIgnored = col.ml_role === 'IGNORE';
                  return (
                    <label 
                      key={col.id} 
                      className={`flex items-start gap-2 text-sm cursor-pointer p-2 rounded transition-colors
                        ${isIgnored ? 'opacity-50' : 'hover:bg-muted'}
                        ${featureColumns.includes(col.column_name) ? 'bg-primary/5 border-primary/20 border' : 'border border-transparent'}
                      `}
                    >
                      <input 
                        type="checkbox" 
                        className="rounded border-border text-primary focus:ring-primary accent-primary mt-0.5"
                        checked={featureColumns.includes(col.column_name)}
                        onChange={() => toggleFeature(col.column_name)}
                        disabled={isTarget || isIgnored}
                      />
                      <div className="flex flex-col">
                        <span className={`font-medium ${isTarget ? "text-muted-foreground line-through" : ""}`}>
                          {col.display_name || col.column_name}
                        </span>
                        <div className="flex gap-1 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tracking-wider uppercase">
                            {col.semantic_type === 'UNKNOWN' ? col.data_type : (col.semantic_type || col.data_type)}
                          </span>
                          {isIgnored && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Ignored</span>}
                          {col.ml_role === 'TARGET' && !isTarget && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Target</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button 
              onClick={handleTrain} 
              disabled={training}
              className="w-full mt-4 flex items-center justify-center gap-2 h-10 shadow-lg shadow-primary/20"
            >
              {training ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                  Training Model...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Train Model
                </>
              )}
            </Button>
            
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-200 dark:border-red-900/50 flex items-start gap-2 mt-4">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="lg:col-span-2">
        {!result && !training ? (
          <div className="h-full min-h-[400px] bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <BrainCircuit className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Ready to Train</h3>
            <p className="text-muted-foreground max-w-md">
              DataLab's NLP pipeline will automatically apply TF-IDF to Text columns, One-Hot Encoding to Categories, and standard scaling to Numerics.
            </p>
          </div>
        ) : training ? (
          <div className="h-full min-h-[400px] bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
              <BrainCircuit className="w-10 h-10 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-xl font-bold mb-2 animate-pulse">Training in Progress...</h3>
            <p className="text-muted-foreground">
              Applying ColumnTransformers, generating TF-IDF sparse matrices, and optimizing hyperparameters...
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Training Complete</h3>
                <p className="text-sm text-muted-foreground">Algorithm: {result.algorithm}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-muted/50 rounded-xl p-5 border border-border">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground font-semibold">
                  <BarChart3 className="w-5 h-5" /> Performance Metrics
                </div>
                <div className="space-y-4">
                  {Object.entries(result.metrics).map(([key, val]: [string, any]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-bold font-mono">
                          {typeof val === 'number' ? (val < 1 ? val.toFixed(4) : val.toFixed(2)) : String(val)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: typeof val === 'number' && val <= 1 ? `${val * 100}%` : '100%' }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-5 border border-border">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground font-semibold">
                  <TrendingUp className="w-5 h-5" /> Feature Importance
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {Object.entries(result.feature_importances || {}).slice(0, 8).map(([feature, imp]: [string, any]) => (
                    <div key={feature}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="truncate max-w-[150px]" title={feature}>{feature}</span>
                        <span className="font-bold">{(imp * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${imp * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(result.feature_importances || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Importances not available for this algorithm.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setResult(null)}>
                Train Another Model <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
