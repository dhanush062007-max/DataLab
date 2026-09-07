import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { Calculator } from "lucide-react";

export default function StatisticsPage() {
  return (
    <DatasetSelector 
      title="Statistical Testing" 
      description="Select a dataset to run hypothesis tests (T-Tests, ANOVA, Chi-Square, etc.) and view past results."
      icon={<Calculator className="w-6 h-6" />}
      targetTab="STATS"
    />
  );
}
