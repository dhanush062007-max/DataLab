"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Database, Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function DatasetSelector({ 
  title, 
  description, 
  icon,
  targetTab
}: { 
  title: string, 
  description: string, 
  icon: React.ReactNode,
  targetTab: string
}) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchDatasets = async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setDatasets(data);
      setLoading(false);
    };
    fetchDatasets();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 h-[calc(100vh-8rem)]">
      
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-border rounded-xl">
          <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No Datasets Found</h3>
          <p className="text-muted-foreground mb-6">You need a dataset before you can use this feature.</p>
          <Link href="/datasets/new">
            <Button>Create Dataset</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets.map(dataset => (
            <div 
              key={dataset.id}
              onClick={() => router.push(`/datasets/${dataset.id}?tab=${targetTab}`)}
              className="bg-card border border-border rounded-xl p-6 shadow-sm hover:border-primary/50 hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="font-bold text-lg truncate pr-2 group-hover:text-primary transition-colors">{dataset.name}</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-bold bg-muted text-muted-foreground shrink-0">
                  {dataset.source_type}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>{dataset.row_count || 0} rows</span>
                </div>
                <div className="text-xs">
                  {new Date(dataset.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
