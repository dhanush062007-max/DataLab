"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, FileType, Columns, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Column = {
  id: string;
  column_name: string;
  data_type: string;
  required: boolean;
};

export default function NewDatasetPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // Step Management
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  
  // Columns
  const [columns, setColumns] = useState<Column[]>([
    { id: "1", column_name: "id", data_type: "INTEGER", required: true }
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
      { id: Date.now().toString(), column_name: "", data_type: "TEXT", required: false }
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length === 1) return; // Prevent deleting last column
    setColumns(columns.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof Column, value: any) => {
    setColumns(columns.map(col => col.id === id ? { ...col, [field]: value } : col));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
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

    // Validate columns
    if (columns.some(c => !c.column_name.trim())) {
      setError("All columns must have a name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create Dataset
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

      // 2. Create Columns
      const columnsToInsert = columns.map((col, index) => ({
        dataset_id: datasetData.id,
        column_name: col.column_name.toLowerCase().replace(/[^a-z0-9_]/g, '_'), // Safe SQL name
        display_name: col.column_name,
        data_type: col.data_type,
        required: col.required,
        position: index
      }));

      const { error: colsError } = await supabase
        .from("dataset_columns")
        .insert(columnsToInsert);

      if (colsError) throw colsError;

      // 3. Success -> Redirect to datasets
      router.push("/datasets");
      router.refresh();

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create dataset.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/datasets">
          <Button variant="outline" size="icon" className="w-10 h-10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Dataset</h1>
          <p className="text-muted-foreground text-sm">Define your dataset structure to begin collecting or importing data.</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center mb-8 px-4">
        <div className={`flex items-center gap-3 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
          <span className="font-semibold text-sm">Details</span>
        </div>
        <div className={`flex-1 h-1 mx-4 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
        <div className={`flex items-center gap-3 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
          <span className="font-semibold text-sm">Schema</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8">
        
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* STEP 1: Details */}
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
                  <div className="text-xs text-muted-foreground mt-1">Upload existing data</div>
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

        {/* STEP 2: Schema */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-2">
              <h3 className="font-semibold text-lg">Define Columns</h3>
              <p className="text-sm text-muted-foreground">Setup the structure of your dataset. You can add more columns later.</p>
            </div>

            <div className="space-y-3">
              {/* Header Row */}
              <div className="hidden sm:grid grid-cols-12 gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1"></div>
                <div className="col-span-5">Column Name</div>
                <div className="col-span-3">Data Type</div>
                <div className="col-span-2 text-center">Required</div>
                <div className="col-span-1"></div>
              </div>

              {/* Column Rows */}
              {columns.map((col, idx) => (
                <div 
                  key={col.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-background border border-border p-3 sm:p-2 rounded-lg group transition-all ${draggedColIndex === idx ? 'opacity-40 border-primary border-dashed' : ''}`}
                >
                  <div className="col-span-1 flex justify-center text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing hidden sm:flex">
                    <GripVertical className="w-5 h-5 pointer-events-none" />
                  </div>
                  <div className="col-span-1 sm:hidden text-xs font-semibold text-muted-foreground uppercase mb-1">Column {idx + 1}</div>
                  
                  <div className="col-span-5">
                    <input 
                      value={col.column_name}
                      onChange={(e) => handleColumnChange(col.id, "column_name", e.target.value)}
                      placeholder="e.g. first_name"
                      className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  
                  <div className="col-span-3">
                    <select 
                      value={col.data_type}
                      onChange={(e) => handleColumnChange(col.id, "data_type", e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="TEXT">Text</option>
                      <option value="INTEGER">Integer (Whole No.)</option>
                      <option value="DECIMAL">Decimal / Float</option>
                      <option value="BOOLEAN">Boolean (True/False)</option>
                      <option value="CATEGORY">Category (Tags)</option>
                      <option value="DATE">Date</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2 flex justify-start sm:justify-center items-center gap-2 mt-2 sm:mt-0">
                    <input 
                      type="checkbox" 
                      checked={col.required}
                      onChange={(e) => handleColumnChange(col.id, "required", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="sm:hidden text-sm">Required Field</span>
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

      </div>
    </div>
  );
}
