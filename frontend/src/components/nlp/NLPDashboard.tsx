import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Tag, Hash, Smile, Frown, Meh, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Cell as PieCell } from "recharts";

interface NLPDashboardProps {
  datasetId: string;
  columns: any[];
}

export function NLPDashboard({ datasetId, columns }: NLPDashboardProps) {
  const textColumns = columns.filter(c => c.semantic_type === 'LONG_TEXT' || c.semantic_type === 'SHORT_TEXT' || c.data_type === 'TEXT');
  const [selectedColumn, setSelectedColumn] = useState<string>(textColumns.length > 0 ? textColumns[0].column_name : "");
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedColumn) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData.session?.access_token;
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/nlp?column=${selectedColumn}`, {
          cache: 'no-store',
          headers
        })
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch NLP analysis");
          return res.json();
        })
        .then(data => {
          setAnalysis(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError("Failed to run NLP Analysis. Ensure backend is running and data is valid.");
          setLoading(false);
        });
      });
    });
  }, [selectedColumn, datasetId]);

  if (textColumns.length === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-xl">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-bold text-lg mb-2">No Text Columns Found</h3>
        <p className="text-muted-foreground text-sm">NLP analysis requires columns with semantic type LONG_TEXT or SHORT_TEXT.</p>
      </div>
    );
  }

  const SENTIMENT_COLORS = {
    positive: '#10b981', // emerald
    neutral: '#94a3b8',  // slate
    negative: '#ef4444'  // red
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Natural Language Processing
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Extract topics and sentiments from unstructured text.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold whitespace-nowrap">Target Column:</label>
          <select 
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="h-10 px-3 rounded-lg border border-input bg-background text-sm min-w-[200px]"
          >
            {textColumns.map(c => (
              <option key={c.id} value={c.column_name}>{c.display_name} ({c.semantic_type === 'UNKNOWN' ? c.data_type : c.semantic_type})</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
          <p>Running Topic Modeling and Sentiment Analysis...</p>
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
          <h3 className="font-bold">Analysis Failed</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {analysis && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Sentiment Analysis */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Smile className="w-4 h-4 text-emerald-500" /> Sentiment Distribution
            </h3>
            
            {analysis.sentiment.total_analyzed === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">No valid text to analyze.</div>
            ) : (
              <>
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Positive', value: analysis.sentiment.positive_pct },
                          { name: 'Neutral', value: analysis.sentiment.neutral_pct },
                          { name: 'Negative', value: analysis.sentiment.negative_pct }
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                        dataKey="value"
                      >
                        <PieCell fill={SENTIMENT_COLORS.positive} />
                        <PieCell fill={SENTIMENT_COLORS.neutral} />
                        <PieCell fill={SENTIMENT_COLORS.negative} />
                      </Pie>
                      <Tooltip formatter={(val) => `${val}%`} contentStyle={{ borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="font-bold">{analysis.sentiment.total_analyzed}</span>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="font-bold text-emerald-600">{analysis.sentiment.positive_pct}%</div>
                    <div className="text-xs text-muted-foreground flex justify-center items-center gap-1"><Smile className="w-3 h-3"/> Pos</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">{analysis.sentiment.neutral_pct}%</div>
                    <div className="text-xs text-muted-foreground flex justify-center items-center gap-1"><Meh className="w-3 h-3"/> Neu</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-600">{analysis.sentiment.negative_pct}%</div>
                    <div className="text-xs text-muted-foreground flex justify-center items-center gap-1"><Frown className="w-3 h-3"/> Neg</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Topic Modeling */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-500" /> Extracted Topics (TF-IDF + NMF)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analysis.topics.map((topic: any) => (
                <div key={topic.topic_id} className="bg-muted/30 border rounded-lg p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex justify-between">
                    <span>Topic {topic.topic_id}</span>
                    <span className="text-blue-500">Weight: {topic.weight.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topic.keywords.map((kw: string) => (
                      <span key={kw} className="px-2 py-1 bg-white dark:bg-background border rounded text-xs font-medium text-foreground">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              
              {(!analysis.topics || analysis.topics.length === 0) && (
                <div className="col-span-2 text-center text-sm text-muted-foreground italic py-8">
                  Not enough varied text to extract meaningful topics.
                </div>
              )}
            </div>
          </div>

          {/* Text Statistics */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-500" /> Corpus Statistics
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Avg Words / Record</div>
                <div className="text-2xl font-bold mt-1">{analysis.statistics.avg_word_count || 0}</div>
              </div>
              
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Max Words / Record</div>
                <div className="text-2xl font-bold mt-1">{analysis.statistics.max_word_count || 0}</div>
              </div>
              
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Avg Characters</div>
                <div className="text-2xl font-bold mt-1">{analysis.statistics.avg_char_count || 0}</div>
              </div>
              
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">Vocabulary Size</div>
                <div className="text-2xl font-bold mt-1">{analysis.statistics.vocabulary_size || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Unique words across corpus</div>
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
