"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, FileType, Columns, Plus, Trash2, GripVertical, CheckCircle, Copy, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Column = {
  id: string;
  column_name: string;
  data_type: string; // Physical
  semantic_type: string;
  ml_role: string;
  encoding_type: string;
  required: boolean;
  options?: string[];
};

const SEMANTIC_TYPES = [
  { value: "UNKNOWN", label: "Auto Detect / Unknown" },
  { value: "INTEGER", label: "Integer (Numeric)" },
  { value: "DECIMAL", label: "Decimal / Float" },
  { value: "BOOLEAN", label: "Boolean (True/False)" },
  { value: "CATEGORY", label: "Category (Nominal)" },
  { value: "TAGS", label: "Tags (Multi-label)" },
  { value: "SINGLE_CHOICE", label: "Single Choice" },
  { value: "ORDINAL_CHOICE", label: "Ordinal Choice" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Date & Time" },
  { value: "SHORT_TEXT", label: "Short Text" },
  { value: "LONG_TEXT", label: "Long Text (NLP)" },
  { value: "IDENTIFIER", label: "Identifier (ID/Email)" },
  { value: "TARGET", label: "Target Variable" }
];

export default function NewDatasetPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // Step Management
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDatasetId, setCreatedDatasetId] = useState<string | null>(null);
  const [createdFormToken, setCreatedFormToken] = useState<string | null>(null);

  // Form Data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  
  // Columns
  const [columns, setColumns] = useState<Column[]>([
    { id: "1", column_name: "id", data_type: "INTEGER", semantic_type: "IDENTIFIER", ml_role: "IGNORE", encoding_type: "NONE", required: true }
  ]);
  
  // Drag and Drop State
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    });
  }, [router]);

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { id: Date.now().toString(), column_name: "", data_type: "TEXT", semantic_type: "UNKNOWN", ml_role: "FEATURE", encoding_type: "NONE", required: false }
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length === 1) return; // Prevent deleting last column
    setColumns(columns.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof Column, value: any) => {
    setColumns(columns.map(col => {
      if (col.id === id) {
        const updated = { ...col, [field]: value };
        
        if (field === "semantic_type") {
          if ((value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE" || value === "ORDINAL_CHOICE") && !updated.options) {
            updated.options = ["", "", "", ""];
          }
          
          if (value === "IDENTIFIER") updated.ml_role = "IGNORE";
          else if (value === "TARGET") updated.ml_role = "TARGET";
          else updated.ml_role = "FEATURE";
          
          if (["INTEGER", "DECIMAL", "BOOLEAN", "DATE", "DATETIME"].includes(value)) updated.encoding_type = "NUMERIC_SCALED";
          else if (["CATEGORY", "SINGLE_CHOICE"].includes(value)) updated.encoding_type = "ONE_HOT";
          else if (["MULTIPLE_CHOICE", "TAGS"].includes(value)) updated.encoding_type = "MULTI_HOT";
          else if (value === "ORDINAL_CHOICE") updated.encoding_type = "ORDINAL";
          else if (["SHORT_TEXT", "LONG_TEXT"].includes(value)) updated.encoding_type = "TFIDF";
          else updated.encoding_type = "NONE";
        }
        return updated;
      }
      return col;
    }));
  };

  const handleOptionChange = (id: string, index: number, value: string) => {
    setColumns(columns.map(col => {
      if (col.id === id && col.options) {
        const newOptions = [...col.options];
        newOptions[index] = value;
        return { ...col, options: newOptions };
      }
      return col;
    }));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === targetIndex) return;

    const newColumns = [...columns];
    const [draggedCol] = newColumns.splice(draggedColIndex, 1);
    newColumns.splice(targetIndex, 0, draggedCol);
    setColumns(newColumns);
    setDraggedColIndex(null);
  };

  const handleCreateDataset = async () => {
    if (!name) {
      setError("Dataset name is required.");
      setStep(1);
      return;
    }

    if (columns.some(c => !c.column_name.trim())) {
      setError("All columns must have a name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: datasetData, error: datasetError } = await supabase
        .from("datasets")
        .insert({
          owner_id: user.id,
          name,
          description,
          source_type: sourceType,
          status: "READY",
          column_count: columns.length
        })
        .select()
        .single();

      if (datasetError) throw datasetError;

      const columnsToInsert = columns.map((col, index) => ({
        dataset_id: datasetData.id,
        column_name: col.column_name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        display_name: col.column_name,
        data_type: col.data_type,
        semantic_type: col.semantic_type,
        ml_role: col.ml_role,
        encoding_type: col.encoding_type,
        required: col.required,
        options: col.options ? col.options.filter(o => o.trim() !== '') : [],
        validation_rules: {},
        position: index
      }));

      const { error: colsError } = await supabase
        .from("dataset_columns")
        .insert(columnsToInsert);

      if (colsError) throw colsError;

      if (sourceType === "FORM") {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const { error: formError } = await supabase
          .from("collection_forms")
          .insert({ dataset_id: datasetData.id, token: token, is_active: true });

        if (formError) throw formError;

        setCreatedFormToken(token);
        setCreatedDatasetId(datasetData.id);
        setStep(3);
      } else {
        router.push("/datasets/" + datasetData.id);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create dataset.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/datasets">
          <Button variant="outline" size="icon" className="w-10 h-10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Dataset</h1>
          <p className="text-muted-foreground text-sm">Define your dataset structure with Semantic Intelligence to begin collecting or importing data.</p>
        </div>
      </div>

      {step < 3 && (
        <div className="flex items-center mb-8 px-4">
          <div className={`flex items-center gap-3 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
            <span className="font-semibold text-sm">Details</span>
          </div>
          <div className={`flex-1 h-1 mx-4 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
          <div className={`flex items-center gap-3 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
            <span className="font-semibold text-sm">Intelligent Schema</span>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dataset Name *</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Employee Retention Data"
                className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold">Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this dataset contains..."
                rows={3}
                className="w-full p-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold">Source Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div 
                  onClick={() => setSourceType("MANUAL")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${sourceType === "MANUAL" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <Database className={`w-6 h-6 mb-2 ${sourceType === "MANUAL" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">Manual / Empty</div>
                  <div className="text-xs text-muted-foreground mt-1">Start from scratch</div>
                </div>
                <div 
                  onClick={() => setSourceType("CSV")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${sourceType === "CSV" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileType className={`w-6 h-6 mb-2 ${sourceType === "CSV" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">Import CSV</div>
                  <div className="text-xs text-muted-foreground mt-1">Upload and auto-detect types</div>
                </div>
                <div 
                  onClick={() => setSourceType("FORM")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${sourceType === "FORM" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <Columns className={`w-6 h-6 mb-2 ${sourceType === "FORM" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">Data Collection Form</div>
                  <div className="text-xs text-muted-foreground mt-1">Public collection link</div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!name}>
                Continue to Schema
                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-2">
              <h3 className="font-semibold text-lg">Define Schema & Semantic Types</h3>
              <p className="text-sm text-muted-foreground">Assigning accurate Semantic Types allows DataLab to automatically perform advanced NLP and ML processing on your columns.</p>
            </div>

            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-12 gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1"></div>
                <div className="col-span-4">Column Name</div>
                <div className="col-span-3">Semantic Type</div>
                <div className="col-span-2 text-center">ML Role</div>
                <div className="col-span-1 text-center">Req</div>
                <div className="col-span-1"></div>
              </div>

              {columns.map((col, idx) => (
                <div 
                  key={col.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`bg-background border border-border p-3 sm:p-2 rounded-lg group transition-all ${draggedColIndex === idx ? 'opacity-40 border-primary border-dashed' : ''}`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="col-span-1 flex justify-center text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing hidden sm:flex">
                      <GripVertical className="w-5 h-5 pointer-events-none" />
                    </div>
                    <div className="col-span-1 sm:hidden text-xs font-semibold text-muted-foreground uppercase mb-1">Column {idx + 1}</div>
                    
                    <div className="col-span-4">
                      <input 
                        value={col.column_name}
                        onChange={(e) => handleColumnChange(col.id, "column_name", e.target.value)}
                        placeholder="e.g. employee_age"
                        className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                    
                    <div className="col-span-3">
                      <select 
                        value={col.semantic_type}
                        onChange={(e) => handleColumnChange(col.id, "semantic_type", e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-input bg-muted text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      >
                        {SEMANTIC_TYPES.map(type => (
                           <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                       <select 
                        value={col.ml_role}
                        onChange={(e) => handleColumnChange(col.id, "ml_role", e.target.value)}
                        className={`w-full h-9 px-2 rounded-md border border-input text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none
                          ${col.ml_role === 'TARGET' ? 'bg-primary/10 text-primary border-primary/30' : 
                            col.ml_role === 'IGNORE' ? 'bg-muted text-muted-foreground' : 'bg-transparent'}`}
                      >
                        <option value="FEATURE">Feature</option>
                        <option value="TARGET">Target</option>
                        <option value="IGNORE">Ignore</option>
                      </select>
                    </div>
                    
                    <div className="col-span-1 flex justify-start sm:justify-center items-center gap-2 mt-2 sm:mt-0">
                      <input 
                        type="checkbox" 
                        checked={col.required}
                        onChange={(e) => handleColumnChange(col.id, "required", e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="sm:hidden text-sm">Required</span>
                    </div>
                    
                    <div className="col-span-1 flex justify-end sm:justify-center mt-2 sm:mt-0">
                      <button 
                        onClick={() => handleRemoveColumn(col.id)}
                        disabled={columns.length === 1}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'ORDINAL_CHOICE'].includes(col.semantic_type) && col.options && (
                    <div className="mt-3 pl-0 sm:pl-12">
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                        Options {col.semantic_type === 'ORDINAL_CHOICE' && "(Order matters!)"}
                        <button onClick={() => handleColumnChange(col.id, "options", [...col.options!, ""])} className="text-primary hover:underline">
                          + Add Option
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {col.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-1">
                            {col.semantic_type === 'ORDINAL_CHOICE' && <span className="text-[10px] text-muted-foreground w-4">{optIdx+1}.</span>}
                            <input
                              value={opt}
                              onChange={(e) => handleOptionChange(col.id, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="w-full h-8 px-2 rounded-md border border-input bg-transparent text-sm focus:ring-1 focus:ring-primary/50 outline-none"
                            />
                            <button 
                              onClick={() => handleColumnChange(col.id, "options", col.options!.filter((_, i) => i !== optIdx))}
                              className="text-muted-foreground hover:text-red-500 p-1"
                            >
                               &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button 
              variant="outline" 
              className="w-full border-dashed border-2 py-6 text-muted-foreground hover:text-foreground hover:border-border"
              onClick={handleAddColumn}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Column
            </Button>

            <div className="pt-6 border-t border-border flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleCreateDataset} disabled={loading} className="px-8">
                {loading ? "Creating..." : "Create Dataset"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500 text-center py-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-50 shadow-sm">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Dataset Created Successfully!</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Your intelligent schema has been saved. Share the public form link below to start collecting properly-typed data.
            </p>
            
            <div className="bg-muted/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border mt-8 max-w-lg mx-auto shadow-inner">
              <div className="flex items-center gap-3 overflow-hidden text-left pr-0 sm:pr-4">
                <div className="p-2 bg-background rounded shadow-sm border border-border hidden sm:block">
                  <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                <span className="text-sm truncate font-medium font-mono text-foreground">{typeof window !== 'undefined' ? window.location.origin : ''}/f/{createdFormToken}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="shrink-0 bg-background hover:bg-muted w-full sm:w-auto"
                onClick={() => {
                  navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/f/${createdFormToken}`);
                  alert("Link copied!");
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copy Link
              </Button>
            </div>

            <div className="pt-10">
              <Link href={`/datasets/${createdDatasetId}`}>
                <Button size="lg" className="w-full sm:w-auto px-10 h-14 rounded-full text-base shadow-[0_0_40px_-10px_rgba(var(--primary),0.5)] hover:shadow-[0_0_60px_-10px_rgba(var(--primary),0.7)] hover:scale-105 transition-all duration-300">
                  Go to Dataset Workspace
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
