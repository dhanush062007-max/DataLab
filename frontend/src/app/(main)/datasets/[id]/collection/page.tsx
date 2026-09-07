"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Copy, CheckCircle2, Link as LinkIcon, AlertCircle, Plus, Eye, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DatasetCollectionPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const router = useRouter();

  const [dataset, setDataset] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Dataset
      const { data: dData, error: dError } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", datasetId)
        .single();
        
      if (dError) {
        console.error(dError);
        router.push("/datasets");
        return;
      }
      setDataset(dData);

      // Fetch Form if exists
      const { data: fData } = await supabase
        .from("collection_forms")
        .select("*")
        .eq("dataset_id", datasetId)
        .maybeSingle();

      if (fData) {
        setForm(fData);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [datasetId, router]);

  const generateForm = async () => {
    setGenerating(true);
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data, error } = await supabase
      .from("collection_forms")
      .insert({
        dataset_id: datasetId,
        token: token,
        is_active: true
      })
      .select()
      .single();

    if (!error && data) {
      setForm(data);
    }
    setGenerating(false);
  };

  const toggleFormStatus = async () => {
    if (!form) return;
    const newStatus = !form.is_active;
    
    const { error } = await supabase
      .from("collection_forms")
      .update({ is_active: newStatus })
      .eq("id", form.id);
      
    if (!error) {
      setForm({ ...form, is_active: newStatus });
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/f/${form.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading collection settings...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/datasets" className="hover:text-foreground transition-colors">Datasets</Link>
          <span>/</span>
          <span className="truncate max-w-[200px]">{dataset.name}</span>
          <span>/</span>
          <span className="text-foreground">Collection Form</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Data Collection Form</h1>
        <p className="text-muted-foreground mt-1">Generate a public link to collect data directly into this dataset.</p>
      </div>

      {!form ? (
        <div className="bg-card border border-border rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
            <LinkIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">No form generated yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md">Create a public collection form to start gathering responses. Anyone with the link will be able to submit data based on your schema.</p>
          <Button onClick={generateForm} size="lg" disabled={generating} className="flex items-center gap-2">
            {generating ? (
              "Generating..."
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Generate Form Link
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    Public Share Link
                    {form.is_active ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">Inactive</span>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Share this URL with your respondents.</p>
                </div>
                <Link href={`/f/${form.token}`} target="_blank">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Preview
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border border-border">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/f/${form.token}`} 
                  className="flex-1 bg-transparent border-none text-sm font-medium focus:ring-0 outline-none px-2 text-foreground"
                />
                <Button onClick={copyLink} variant={copied ? "default" : "secondary"} className={copied ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold mb-4">Form Settings</h2>
              
              <div className="flex items-center justify-between py-4 border-b border-border">
                <div>
                  <div className="font-medium">Form Status</div>
                  <div className="text-sm text-muted-foreground">Turn off to prevent new submissions.</div>
                </div>
                <Button onClick={toggleFormStatus} variant={form.is_active ? "destructive" : "default"} className="w-32">
                  {form.is_active ? (
                    <><PauseCircle className="w-4 h-4 mr-2"/> Deactivate</>
                  ) : (
                    <><PlayCircle className="w-4 h-4 mr-2"/> Activate</>
                  )}
                </Button>
              </div>
              
              <div className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium">Rate Limiting</div>
                  <div className="text-sm text-muted-foreground">Max submissions per minute (Coming soon)</div>
                </div>
                <select disabled className="h-9 px-3 rounded-md border border-input bg-muted/50 text-sm outline-none cursor-not-allowed opacity-50">
                  <option>5 per minute</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-primary">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold">Security Notice</h3>
              </div>
              <p className="text-sm leading-relaxed opacity-90">
                Anyone with this link can submit data to your dataset. Submissions are inserted directly into your database using a secure Row Level Security bypass function.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
