"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Play, AlertCircle, BarChart3, Settings, TrendingUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatisticalTestingProps {
  datasetId: string;
  columns: any[];
}

export function StatisticalTesting({ datasetId, columns }: StatisticalTestingProps) {
  const [testType, setTestType] = useState<string>("T_TEST_IND");
  const [variableA, setVariableA] = useState<string>("");
  const [variableB, setVariableB] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("");
  
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [datasetId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/datasets/${datasetId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunTest = async () => {
    if (!variableA) {
      setError("Please select the primary variable.");
      return;
    }

    if (["T_TEST_IND", "ANOVA"].includes(testType) && !groupBy) {
      setError("Please select a grouping variable.");
      return;
    }

    if (["T_TEST_PAIRED", "PEARSON", "SPEARMAN", "CHI_SQUARE"].includes(testType) && !variableB) {
      setError("Please select a secondary variable.");
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required");

      const res = await fetch(`http://localhost:8000/api/v1/datasets/${datasetId}/stats/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          test_type: testType,
          variable_a: variableA,
          variable_b: variableB || null,
          group_by: groupBy || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Test failed");

      setResult(data);
      fetchHistory(); // Refresh history
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const numericColumns = columns.filter(c => c.data_type === "INTEGER" || c.data_type === "DECIMAL");
  const catColumns = columns.filter(c => c.data_type === "VARCHAR" || c.data_type === "BOOLEAN");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Configuration */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Test Configuration
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Test Type</label>
              <select 
                className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                value={testType}
                onChange={e => {
                  setTestType(e.target.value);
                  setVariableA("");
                  setVariableB("");
                  setGroupBy("");
                }}
              >
                <optgroup label="Comparing Means">
                  <option value="T_TEST_IND">Independent T-Test (2 groups)</option>
                  <option value="T_TEST_PAIRED">Paired T-Test</option>
                  <option value="ANOVA">ANOVA (3+ groups)</option>
                </optgroup>
                <optgroup label="Correlation">
                  <option value="PEARSON">Pearson Correlation</option>
                  <option value="SPEARMAN">Spearman Correlation</option>
                </optgroup>
                <optgroup label="Categorical">
                  <option value="CHI_SQUARE">Chi-Square Test</option>
                </optgroup>
              </select>
            </div>

            {/* Variable A (Always present) */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                {testType === "CHI_SQUARE" ? "Categorical Variable A" : "Numeric Variable"}
              </label>
              <select 
                className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                value={variableA}
                onChange={e => setVariableA(e.target.value)}
              >
                <option value="">-- Select Variable --</option>
                {(testType === "CHI_SQUARE" ? catColumns : numericColumns).map(col => (
                  <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
                ))}
              </select>
            </div>

            {/* Group By (For IND T-Test and ANOVA) */}
            {["T_TEST_IND", "ANOVA"].includes(testType) && (
              <div>
                <label className="block text-sm font-semibold mb-1">Grouping Variable</label>
                <select 
                  className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                >
                  <option value="">-- Select Group --</option>
                  {catColumns.map(col => (
                    <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Variable B (For Paired T-Test, Correlation, Chi-Square) */}
            {["T_TEST_PAIRED", "PEARSON", "SPEARMAN", "CHI_SQUARE"].includes(testType) && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {testType === "CHI_SQUARE" ? "Categorical Variable B" : "Secondary Numeric Variable"}
                </label>
                <select 
                  className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                  value={variableB}
                  onChange={e => setVariableB(e.target.value)}
                >
                  <option value="">-- Select Variable --</option>
                  {(testType === "CHI_SQUARE" ? catColumns : numericColumns).map(col => (
                    <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
                  ))}
                </select>
              </div>
            )}

            <Button 
              onClick={handleRunTest} 
              disabled={running}
              className="w-full mt-4 flex items-center justify-center gap-2 h-10 shadow-lg shadow-primary/20"
            >
              {running ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                  Running Test...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Statistical Test
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

      {/* Right Column: Results & History */}
      <div className="lg:col-span-2 space-y-6">
        {result ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
             <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
               <TrendingUp className="w-48 h-48" />
             </div>
             
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                 <BarChart3 className="w-5 h-5 text-primary" />
               </div>
               <div>
                 <h2 className="text-xl font-bold">{result.test_type.replace(/_/g, ' ')}</h2>
                 <p className="text-sm text-muted-foreground">Results Analysis</p>
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Test Statistic</div>
                  <div className="text-2xl font-black text-foreground">
                    {result.test_statistic !== null ? result.test_statistic.toFixed(4) : "N/A"}
                  </div>
                </div>
                <div className={`p-4 rounded-lg border ${result.p_value !== null && result.p_value < 0.05 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50' : 'bg-muted/30 border-border'}`}>
                  <div className={`text-xs uppercase tracking-widest font-bold mb-1 ${result.p_value !== null && result.p_value < 0.05 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>P-Value</div>
                  <div className={`text-2xl font-black ${result.p_value !== null && result.p_value < 0.05 ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                    {result.p_value !== null ? (result.p_value < 0.0001 ? '<0.0001' : result.p_value.toFixed(4)) : "N/A"}
                  </div>
                </div>
                {result.degrees_of_freedom !== null && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Degrees of Freedom</div>
                    <div className="text-2xl font-black text-foreground">
                      {result.degrees_of_freedom}
                    </div>
                  </div>
                )}
             </div>

             <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">Plain English Interpretation</h4>
                  <p className="text-sm text-foreground/90 leading-relaxed">{result.interpretation}</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="h-[300px] bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Statistical Testing Engine</h2>
            <p className="text-muted-foreground max-w-md">
              Select a hypothesis test and the variables you wish to compare. The engine will run rigorous tests and provide plain English interpretations.
            </p>
          </div>
        )}

        {/* Test History */}
        {history.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Past Tests</h3>
            <div className="space-y-3">
              {history.map((test: any) => (
                <div key={test.id} className="p-3 border border-border rounded-lg bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setResult(test)}>
                  <div>
                    <div className="font-semibold text-sm">{test.test_type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted-foreground">
                      {test.variable_a} {test.group_by ? `by ${test.group_by}` : test.variable_b ? `& ${test.variable_b}` : ""}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2 sm:block">
                    <div className="text-xs text-muted-foreground">{new Date(test.created_at).toLocaleString()}</div>
                    <div className={`text-xs font-bold ${test.p_value < 0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      p = {test.p_value !== null ? (test.p_value < 0.0001 ? '<0.0001' : test.p_value.toFixed(4)) : "N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
