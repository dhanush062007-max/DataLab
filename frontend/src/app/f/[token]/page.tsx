"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FlaskConical, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicFormPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const { data, error } = await supabase.rpc("get_form_schema", { p_token: token });
        
        if (error) throw error;
        if (!data) throw new Error("Form not found");
        
        setSchema(data);
        
        // Initialize form data
        const initialData: Record<string, any> = {};
        data.columns.forEach((col: any) => {
          if (col.data_type === "BOOLEAN") initialData[col.column_name] = false;
          else if (col.data_type === "MULTIPLE_CHOICE") initialData[col.column_name] = [];
          else initialData[col.column_name] = "";
        });
        setFormData(initialData);

      } catch (err: any) {
        setError(err.message || "Failed to load form. It may be inactive or invalid.");
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchSchema();
  }, [token]);

  const handleInputChange = (colName: string, value: any) => {
    setFormData(prev => ({ ...prev, [colName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Basic required validation
    for (const col of schema.columns) {
      const val = formData[col.column_name];
      if (col.required) {
        if (val === "" || val === null || (col.data_type === "MULTIPLE_CHOICE" && Array.isArray(val) && val.length === 0)) {
          setError(`Field '${col.display_name}' is required.`);
          setSubmitting(false);
          return;
        }
      }
    }

    // Enforce Rate Limit (Browser-based)
    const maxPerMinute = schema.rate_limit_settings?.max_per_minute || 5;
    const limitKey = `datalab_rate_limit_${token}`;
    const now = Date.now();
    let history: number[] = [];
    
    try {
      const stored = localStorage.getItem(limitKey);
      if (stored) history = JSON.parse(stored);
    } catch(e) {}

    // Filter out timestamps older than 60 seconds
    history = history.filter(t => now - t < 60000);

    if (history.length >= maxPerMinute) {
      setError(`Rate limit exceeded. You can only submit ${maxPerMinute} responses per minute. Please try again shortly.`);
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("submit_form_response", {
        p_token: token,
        p_data: formData
      });

      if (error) throw error;
      
      // Save successful submission timestamp
      history.push(now);
      localStorage.setItem(limitKey, JSON.stringify(history));
      
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message || "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="animate-spin text-primary mb-4"><FlaskConical className="w-8 h-8" /></div>
        <p className="text-muted-foreground font-medium">Loading form...</p>
      </div>
    );
  }

  if (error && !schema) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="bg-card p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-border">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Form Unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="bg-card p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-border">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-6">Your response has been successfully recorded.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            Submit Another Response
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4 text-primary">
            <FlaskConical className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{schema.name}</h1>
          {schema.description && (
            <p className="text-muted-foreground text-lg">{schema.description}</p>
          )}
        </div>

        {/* Form Container */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {schema.columns.map((col: any) => (
              <div key={col.id} className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1">
                  {col.display_name}
                  {col.required && <span className="text-red-500">*</span>}
                </label>
                
                {col.data_type === "TEXT" && (
                  <input 
                    type="text"
                    value={formData[col.column_name]}
                    onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                    required={col.required}
                    className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                )}

                {(col.data_type === "INTEGER" || col.data_type === "DECIMAL") && (
                  <input 
                    type="number"
                    step={col.data_type === "DECIMAL" ? "any" : "1"}
                    value={formData[col.column_name]}
                    onChange={(e) => handleInputChange(col.column_name, e.target.value === "" ? "" : Number(e.target.value))}
                    required={col.required}
                    className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                )}

                {col.data_type === "DATE" && (
                  <input 
                    type="date"
                    value={formData[col.column_name]}
                    onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                    required={col.required}
                    className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                )}

                {col.data_type === "BOOLEAN" && (
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <input 
                      type="checkbox"
                      checked={formData[col.column_name]}
                      onChange={(e) => handleInputChange(col.column_name, e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Yes / True</span>
                  </label>
                )}

                {col.data_type === "SINGLE_CHOICE" && (
                  <select
                    value={formData[col.column_name] || ""}
                    onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                    required={col.required}
                    className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  >
                    <option value="" disabled>Select an option</option>
                    {col.validation_rules?.choices?.map((choice: string, idx: number) => (
                      <option key={idx} value={choice}>{choice}</option>
                    ))}
                  </select>
                )}

                {col.data_type === "MULTIPLE_CHOICE" && (
                  <div className="space-y-2">
                    {col.validation_rules?.choices?.map((choice: string, idx: number) => {
                      const isChecked = (formData[col.column_name] || []).includes(choice);
                      return (
                        <label key={idx} className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentSelected = formData[col.column_name] || [];
                              if (e.target.checked) {
                                handleInputChange(col.column_name, [...currentSelected, choice]);
                              } else {
                                handleInputChange(col.column_name, currentSelected.filter((c: string) => c !== choice));
                              }
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">{choice}</span>
                        </label>
                      );
                    })}
                    {col.required && (formData[col.column_name] || []).length === 0 && (
                      <input type="text" className="opacity-0 w-0 h-0 absolute pointer-events-none" required />
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-6 border-t border-border">
              <Button type="submit" size="lg" className="w-full text-base" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Response"}
              </Button>
            </div>
          </form>
        </div>
        
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Powered by <strong>DataLab</strong>
        </div>
      </div>
    </div>
  );
}
