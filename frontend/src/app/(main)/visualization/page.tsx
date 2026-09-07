import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { BarChart3 } from "lucide-react";

export default function VisualizationPage() {
  return (
    <DatasetSelector 
      title="Data Visualization" 
      description="Select a dataset to view charts, distributions, correlations, and exploratory data analysis."
      icon={<BarChart3 className="w-6 h-6" />}
      targetTab="VISUALIZATION"
    />
  );
}
