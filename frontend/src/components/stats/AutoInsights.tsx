import { useEffect, useState } from "react";
import { Loader2, Sparkles, TrendingUp, BarChart3, AlertCircle } from "lucide-react";

interface AutoInsightsProps {
  datasetId: string;
}

export function AutoInsights({ datasetId }: AutoInsightsProps) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData.session?.access_token;
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/stats/insights`, {
          headers
        })
        .then(res => {
          if (!res.ok) throw new Error("Failed to generate insights");
          return res.json();
        })
        .then(data => {
          setInsights(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError("Failed to generate automatic insights.");
          setLoading(false);
        });
      });
    });
  }, [datasetId]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <h3 className="font-bold">Discovering Relationships...</h3>
        <p className="text-sm text-muted-foreground mt-1">Scanning the dataset for statistically significant correlations and differences.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-red-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return null; // Or show a message if there are no insights found.
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
          Auto-Discovered Insights
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="bg-background/80 backdrop-blur-sm border border-border rounded-lg p-4 shadow-sm flex items-start gap-3 transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
              {insight.type === "correlation" ? (
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium leading-snug">{insight.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {insight.type}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${insight.p_value < 0.01 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                  p {insight.p_value < 0.0001 ? '<0.0001' : `= ${insight.p_value.toFixed(4)}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
