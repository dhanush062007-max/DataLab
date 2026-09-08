import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

type EDAStats = {
  total_rows: number;
  columns: any[];
};

export function EDAOverview({ datasetId }: { datasetId: string }) {
  const [stats, setStats] = useState<EDAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData.session?.access_token;
        
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/eda?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch EDA data");
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("The FastAPI backend is not running or encountered an error processing this dataset.");
        setLoading(false);
      });
    });
    });
  }, [datasetId]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Crunching numbers with Intelligent Type Detection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold">Analysis Failed</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.total_rows === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-xl">
        <h3 className="font-bold text-lg mb-2">No Data Available</h3>
        <p className="text-muted-foreground text-sm">Upload a CSV or add records manually to see Exploratory Data Analysis (EDA).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Missing Data Overview */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4">Data Quality (Missing Values)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.columns} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} fontSize={12} tick={{fill: 'currentColor', opacity: 0.7}} />
              <YAxis fontSize={12} tick={{fill: 'currentColor', opacity: 0.7}} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'transparent', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="null_percentage" name="% Missing" radius={[4, 4, 0, 0]}>
                {stats.columns.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.null_percentage > 50 ? '#ef4444' : entry.null_percentage > 0 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {stats.columns.map((col: any) => (
          <div key={col.name} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold truncate" title={col.name}>{col.name}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider
                ${col.semantic_type === 'UNKNOWN' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary border border-primary/20'}
              `}>
                {col.semantic_type || col.type}
              </span>
            </div>
            
            {['LONG_TEXT', 'SHORT_TEXT'].includes(col.semantic_type) ? (
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Avg Length</div>
                  <div className="font-semibold">{col.avg_length !== undefined ? col.avg_length.toFixed(1) + ' chars' : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Avg Words</div>
                  <div className="font-semibold">{col.avg_words !== undefined ? col.avg_words.toFixed(1) + ' words' : 'N/A'}</div>
                </div>
              </div>
            ) : col.is_numeric ? (
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Mean</div>
                  <div className="font-semibold">{col.mean !== null ? col.mean.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Median</div>
                  <div className="font-semibold">{col.median !== null ? col.median.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Min</div>
                  <div className="font-semibold">{col.min !== null ? col.min.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Max</div>
                  <div className="font-semibold">{col.max !== null ? col.max.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-semibold mb-2">
                  {col.semantic_type === 'MULTIPLE_CHOICE' || col.semantic_type === 'TAGS' ? 'Top Tags/Options' : 'Top Categories'}
                </div>
                {col.top_categories?.map((cat: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="truncate max-w-[150px]">{cat.name === 'None' ? '(Missing)' : cat.name}</span>
                    <span className="font-semibold text-primary">{cat.count}</span>
                  </div>
                ))}
                {(!col.top_categories || col.top_categories.length === 0) && (
                   <span className="text-xs text-muted-foreground italic">No values to display.</span>
                )}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs">
              <span className="text-muted-foreground">Missing Values:</span>
              <span className={`font-semibold ${col.null_count > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {col.null_count} ({col.null_percentage}%)
              </span>
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}
