import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { Compass } from "lucide-react";

export default function ExplorePage() {
  return (
    <DatasetSelector 
      title="Data Explorer" 
      description="Select a dataset to view its Exploratory Data Analysis (EDA) and basic statistics."
      icon={<Compass className="w-6 h-6" />}
      targetTab="EDA"
    />
  );
}
