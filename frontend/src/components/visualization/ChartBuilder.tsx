"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Play, AlertCircle, BarChart3, Settings, PieChart, ScatterChart as ScatterIcon, LineChart as LineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend,
  LineChart, Line, ScatterChart, Scatter, PieChart as RechartsPieChart, Pie
} from "recharts";

interface ChartBuilderProps {
  datasetId: string;
  columns: any[];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#14b8a6", "#f43f5e"];

export function ChartBuilder({ datasetId, columns }: ChartBuilderProps) {
  const [chartType, setChartType] = useState<string>("BAR");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
  const [aggregation, setAggregation] = useState<string>("NONE");
  
  const [running, setRunning] = useState(false);
  const [runningSlow, setRunningSlow] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!xAxis) {
      setError("Please select an X-Axis variable.");
      return;
    }

    if (["BAR", "LINE", "SCATTER"].includes(chartType) && !yAxis && aggregation !== "COUNT") {
      setError("Please select a Y-Axis variable, or set aggregation to COUNT.");
      return;
    }

    if (chartType === "PIE" && !yAxis && aggregation !== "COUNT") {
      setError("Please select a Metric (Y-Axis) for the Pie Chart, or set aggregation to COUNT.");
      return;
    }

    setRunning(true);
    setRunningSlow(false);
    setError(null);
    setResult(null);

    const slowTimer = setTimeout(() => {
      setRunningSlow(true);
    }, 5000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/visualize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          chart_type: chartType,
          x_axis: xAxis,
          y_axis: yAxis || null,
          aggregation: aggregation
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Visualization generation failed");

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearTimeout(slowTimer);
      setRunning(false);
      setRunningSlow(false);
    }
  };

  const numericColumns = columns.filter(c => ['INTEGER', 'DECIMAL'].includes(c.semantic_type || c.data_type));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Configuration */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Chart Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Chart Type</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={chartType === "BAR" ? "default" : "outline"} 
                  onClick={() => setChartType("BAR")}
                  className="flex items-center gap-2 h-10"
                >
                  <BarChart3 className="w-4 h-4" /> Bar
                </Button>
                <Button 
                  variant={chartType === "LINE" ? "default" : "outline"} 
                  onClick={() => setChartType("LINE")}
                  className="flex items-center gap-2 h-10"
                >
                  <LineIcon className="w-4 h-4" /> Line
                </Button>
                <Button 
                  variant={chartType === "SCATTER" ? "default" : "outline"} 
                  onClick={() => setChartType("SCATTER")}
                  className="flex items-center gap-2 h-10"
                >
                  <ScatterIcon className="w-4 h-4" /> Scatter
                </Button>
                <Button 
                  variant={chartType === "PIE" ? "default" : "outline"} 
                  onClick={() => setChartType("PIE")}
                  className="flex items-center gap-2 h-10"
                >
                  <PieChart className="w-4 h-4" /> Pie
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                {chartType === "PIE" ? "Category (Label)" : "X-Axis Variable"}
              </label>
              <select 
                className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                value={xAxis}
                onChange={e => setXAxis(e.target.value)}
              >
                <option value="">-- Select Variable --</option>
                {columns.map(col => (
                  <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
                ))}
              </select>
            </div>

            {chartType !== "SCATTER" && (
              <div>
                <label className="block text-sm font-semibold mb-1">Aggregation</label>
                <select 
                  className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                  value={aggregation}
                  onChange={e => {
                    setAggregation(e.target.value);
                    if (e.target.value === "COUNT") setYAxis("");
                  }}
                >
                  <option value="NONE">None (Raw Data limit 100)</option>
                  <option value="SUM">Sum</option>
                  <option value="MEAN">Mean / Average</option>
                  <option value="COUNT">Count</option>
                  <option value="MAX">Max</option>
                  <option value="MIN">Min</option>
                </select>
              </div>
            )}

            {aggregation !== "COUNT" && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {chartType === "PIE" ? "Metric (Value)" : "Y-Axis Variable"}
                </label>
                <select 
                  className="w-full bg-muted border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
                  value={yAxis}
                  onChange={e => setYAxis(e.target.value)}
                >
                  <option value="">-- Select Numeric Variable --</option>
                  {numericColumns.map(col => (
                    <option key={col.id} value={col.column_name}>{col.display_name || col.column_name}</option>
                  ))}
                </select>
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              disabled={running}
              className="w-full mt-4 flex items-center justify-center gap-2 h-10 shadow-lg shadow-primary/20"
            >
              {running ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Generate Chart
                </>
              )}
            </Button>
            
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-200 dark:border-red-900/50 flex items-start gap-2 mt-4">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {runningSlow && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-sm rounded-md border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 mt-4 animate-pulse">
                <div className="w-4 h-4 mt-0.5 shrink-0 animate-spin border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full" />
                <div>
                  <span className="font-bold block">Processing out-of-core...</span>
                  <span className="opacity-90">Streaming and aggregating thousands of rows. This might take a few seconds...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Visualization */}
      <div className="lg:col-span-2">
        {result ? (
          <div className="h-full min-h-[500px] bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden">
             
             <div className="flex items-center justify-between mb-8">
               <div>
                 <h2 className="text-xl font-bold">{result.chart_type} CHART</h2>
                 <p className="text-sm text-muted-foreground">{result.x_axis} vs {result.y_axis || 'COUNT'}</p>
               </div>
             </div>

             <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  {result.chart_type === "BAR" ? (
                    <BarChart data={result.data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{fill: 'currentColor', opacity: 0.7}} />
                      <YAxis tick={{fill: 'currentColor', opacity: 0.7}} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey={result.y_axis || 'COUNT'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : result.chart_type === "LINE" ? (
                    <LineChart data={result.data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{fill: 'currentColor', opacity: 0.7}} />
                      <YAxis tick={{fill: 'currentColor', opacity: 0.7}} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Line type="monotone" dataKey={result.y_axis || 'COUNT'} stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  ) : result.chart_type === "PIE" ? (
                    <RechartsPieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Pie 
                        data={result.data} 
                        dataKey={result.y_axis || 'COUNT'} 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={150} 
                        fill="#8884d8" 
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {result.data.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  ) : (
                    <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" dataKey={result.x_axis} name={result.x_axis} tick={{fill: 'currentColor', opacity: 0.7}} />
                      <YAxis type="number" dataKey={result.y_axis} name={result.y_axis} tick={{fill: 'currentColor', opacity: 0.7}} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }} />
                      <Scatter name="Data" data={result.data} fill="#8b5cf6" />
                    </ScatterChart>
                  )}
                </ResponsiveContainer>
             </div>
          </div>
        ) : (
          <div className="h-[500px] bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <BarChart3 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Visualization Studio</h2>
            <p className="text-muted-foreground max-w-md">
              Configure your chart on the left. Select a chart type, axes, and aggregation method to build a custom visualization.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
