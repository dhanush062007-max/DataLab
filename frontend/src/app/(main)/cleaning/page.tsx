import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { Wand2 } from "lucide-react";

export default function CleaningPage() {
  return (
    <DatasetSelector 
      title="Data Cleaning Studio" 
      description="Select a dataset to clean its data using Pandas."
      icon={<Wand2 className="w-6 h-6" />}
      targetTab="CLEANING"
    />
  );
}
