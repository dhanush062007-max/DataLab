import { ArrowRight, Box, Type, Hash, Tag, Scale } from "lucide-react";

interface FeaturePipelinePreviewProps {
  columns: any[];
  featureColumns: string[];
}

export function FeaturePipelinePreview({ columns, featureColumns }: FeaturePipelinePreviewProps) {
  if (featureColumns.length === 0) return null;

  const getPipelineSteps = (colName: string) => {
    const col = columns.find(c => c.column_name === colName);
    if (!col) return [];

    const semType = col.semantic_type || col.data_type || "VARCHAR";
    
    if (semType === "INTEGER" || semType === "DECIMAL" || semType === "NUMERIC") {
      return [
        { name: "Median Imputer", icon: <Box className="w-3 h-3" /> },
        { name: "Standard Scaler", icon: <Scale className="w-3 h-3" /> }
      ];
    } else if (semType === "LONG_TEXT" || semType === "REVIEW") {
      return [
        { name: "TF-IDF Vectorizer", icon: <Type className="w-3 h-3" /> }
      ];
    } else {
      return [
        { name: "Constant Imputer", icon: <Box className="w-3 h-3" /> },
        { name: "One-Hot Encoder", icon: <Tag className="w-3 h-3" /> }
      ];
    }
  };

  return (
    <div className="mt-6 border border-border rounded-lg bg-card overflow-hidden">
      <div className="bg-muted/50 p-3 border-b border-border text-sm font-semibold flex items-center gap-2">
        <Hash className="w-4 h-4 text-primary" />
        Feature Transformation Pipeline
      </div>
      <div className="p-4 max-h-[250px] overflow-y-auto space-y-3">
        {featureColumns.map(colName => {
          const steps = getPipelineSteps(colName);
          return (
            <div key={colName} className="flex items-center text-sm">
              <span className="font-medium w-1/3 truncate" title={colName}>{colName}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground mx-2 shrink-0" />
              <div className="flex flex-wrap gap-2 flex-1">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded text-xs border border-primary/20">
                    {step.icon}
                    {step.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
