import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <DatasetSelector 
      title="Automated Reports" 
      description="Select a dataset to generate and export a comprehensive summary report of your data, models, and findings."
      icon={<FileText className="w-6 h-6" />}
      targetTab="REPORT"
    />
  );
}
