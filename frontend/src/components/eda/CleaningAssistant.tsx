import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, ArrowRight } from "lucide-react";

interface CleaningAssistantProps {
  datasetId: string;
  suggestions: any;
  onCleaned: () => void;
}

export function CleaningAssistant({ datasetId, suggestions, onCleaned }: CleaningAssistantProps) {
  const [loading, setLoading] = useState<string | null>(null); // holds col_name + action

  const applyCleaning = (col: string, action: string, operation: string) => {
    setLoading(`${col}_${action}`);
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: authData }) => {
        const token = authData.session?.access_token;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Map abstract suggestion action to our actual backend operation
        let apiOperation = "";
        if (operation === "drop") apiOperation = "DROP_NULLS";
        if (operation === "impute") apiOperation = "FILL_MEAN";
        // Note: NORMALIZE_TEXT is not yet in the backend, but we can add it to the UI and just error gracefully if not supported, or just use it if we implemented it. For now, just handling the ones we know.
        if (operation === "normalize_text") apiOperation = "NORMALIZE_TEXT"; 

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/clean`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            operation: apiOperation,
            parameters: { column: col, columns: [col] }
          })
        })
        .then(res => res.json())
        .then(() => {
          setLoading(null);
          onCleaned();
        })
        .catch(err => {
          console.error(err);
          setLoading(null);
          alert("Failed to apply cleaning operation. " + (err.message || ""));
        });
      });
    });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-200">Smart Cleaning Assistant</h3>
      </div>
      
      <div className="space-y-4">
        {Object.keys(suggestions).map(colName => (
          <div key={colName} className="bg-white dark:bg-background border rounded-xl p-4 space-y-3 shadow-sm">
            <h4 className="font-semibold text-sm mb-2 px-2 border-l-2 border-indigo-400">Column: {colName}</h4>
            
            <div className="space-y-2">
              {suggestions[colName].map((sugg: any, idx: number) => {
                const isLoading = loading === `${colName}_${sugg.action}`;
                
                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg text-sm border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{sugg.description}</div>
                      
                      {/* Preview for normalization */}
                      {sugg.preview && (
                        <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                          <div className="font-semibold mb-1">Preview of changes:</div>
                          {Object.keys(sugg.preview).map(normalized => (
                            <div key={normalized} className="flex items-center gap-2 py-0.5">
                              <span className="text-red-500 line-through truncate max-w-[100px]">{sugg.preview[normalized].join(', ')}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{normalized}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      variant={sugg.action === 'drop' ? 'destructive' : 'default'}
                      size="sm"
                      disabled={loading !== null}
                      onClick={() => applyCleaning(colName, sugg.action, sugg.action)}
                      className="shrink-0"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Apply
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
