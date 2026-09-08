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
    // Auto-select features initially
    if (columns && columns.length > 0 && featureColumns.length === 0) {
      setFeatureColumns(columns.map(c => c.column_name));
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
      if (!res.ok) throw new Error(data.detail || "Training failed");

      // Save to Supabase (Explicitly generate a unique ID to prevent any DB constraint issues)
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
                {columns.map(col => (
                  <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
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
              <label className="block text-sm font-semibold mb-2">Features (Input variables)</label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {columns.map(col => (
                  <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                    <input 
                      type="checkbox" 
                      className="rounded border-border text-primary focus:ring-primary accent-primary"
                      checked={featureColumns.includes(col.column_name)}
                      onChange={() => toggleFeature(col.column_name)}
                      disabled={col.column_name === targetColumn}
                    />
                    <span className={col.column_name === targetColumn ? "text-muted-foreground line-through" : ""}>
                      {col.display_name || col.column_name}
                    </span>
                  </label>
                ))}
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
            <h2 className="text-xl font-bold mb-2">Ready to Train</h2>
            <p className="text-muted-foreground max-w-md">
              Configure your model on the left by selecting what you want to predict and what data to use. Click train to see the magic happen!
            </p>
          </div>
        ) : training ? (
          <div className="h-full min-h-[400px] bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 animate-pulse"></div>
             <BrainCircuit className="w-16 h-16 text-primary animate-bounce mb-6" />
             <h2 className="text-xl font-bold mb-2">Training in Progress...</h2>
             <p className="text-muted-foreground">Feeding data to the algorithm and tuning parameters.</p>
          </div>
        ) : result ? (
          <div className="space-y-6">
            
            {/* Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(result.metrics || {}).filter(([k]) => k !== 'confusion_matrix').map(([key, val]: any) => (
                <div key={key} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">{key.replace('_', ' ')}</span>
                  <span className="text-2xl font-black text-primary">
                    {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(4) : val) : val}
                  </span>
                </div>
              ))}
            </div>

            {/* Feature Importances */}
            {result.feature_importances && Object.keys(result.feature_importances).length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Feature Importance
                </h3>
                <div className="space-y-4">
                  {Object.entries(result.feature_importances)
                    .sort((a: any, b: any) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([feat, imp]: any) => (
                    <div key={feat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{feat}</span>
                        <span className="text-muted-foreground">{(imp * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/80 rounded-full" 
                          style={{ width: `${Math.max(1, imp * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : null}
      </div>

    </div>
  );
}
