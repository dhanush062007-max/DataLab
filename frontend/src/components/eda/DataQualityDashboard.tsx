import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, AlertCircle, Info } from "lucide-react";
import { CleaningAssistant } from "./CleaningAssistant";

interface DataQualityProps {
  datasetId: string;
}

export function DataQualityDashboard({ datasetId }: DataQualityProps) {
  const [quality, setQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuality = () => {
    setLoading(true);
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData.session?.access_token;
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/quality`, {
          // Note: The URL is prefixed with /datasets in router, so the path is /api/v1/datasets/{datasetId}/quality
          cache: 'no-store',
          headers
        })
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch data quality");
          return res.json();
        })
        .then(data => {
          setQuality(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError("Failed to analyze data quality. Please try again.");
          setLoading(false);
        });
      });
    });
  };

  useEffect(() => {
    fetchQuality();
  }, [datasetId]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Analyzing dataset for outliers, duplicates, and inconsistencies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-bold">Analysis Failed</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!quality || !quality.breakdown) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 70) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
    if (score >= 70) return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
    return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`col-span-1 border rounded-xl p-6 flex flex-col items-center justify-center ${getScoreBg(quality.score)}`}>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">Overall Quality</div>
          <div className={`text-6xl font-black ${getScoreColor(quality.score)}`}>{quality.score}</div>
          <div className="text-sm text-muted-foreground mt-2">out of 100</div>
        </div>

        <div className="col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-bold mb-4 text-lg">Score Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completeness</span>
                <span className="font-semibold">{quality.breakdown.completeness}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${quality.breakdown.completeness}%` }}></div>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uniqueness</span>
                <span className="font-semibold">{quality.breakdown.uniqueness}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${quality.breakdown.uniqueness}%` }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consistency</span>
                <span className="font-semibold">{quality.breakdown.consistency}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${quality.breakdown.consistency}%` }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outlier Risk</span>
                <span className="font-semibold">{quality.breakdown.outlier_risk}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${quality.breakdown.outlier_risk}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {quality.warnings.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" /> Actionable Warnings
          </h3>
          <div className="space-y-3">
            {quality.warnings.map((warn: any, idx: number) => (
              <div key={idx} className={`p-3 rounded-lg border flex gap-3 text-sm
                ${warn.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}
              `}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold uppercase text-xs mr-2 opacity-70">[{warn.type}]</span>
                  {warn.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {quality.warnings.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-6 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <div className="font-semibold">No critical warnings! Your dataset looks incredibly clean.</div>
        </div>
      )}

      {/* Smart Cleaning Suggestions */}
      {Object.keys(quality.cleaning_suggestions || {}).length > 0 && (
        <CleaningAssistant 
          datasetId={datasetId} 
          suggestions={quality.cleaning_suggestions} 
          onCleaned={fetchQuality} 
        />
      )}
    </div>
  );
}
