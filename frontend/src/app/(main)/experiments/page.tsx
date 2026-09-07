import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { FlaskConical } from "lucide-react";

export default function ExperimentsPage() {
  return (
    <DatasetSelector 
      title="Machine Learning Experiments" 
      description="Select a dataset to view your past machine learning experiments, hyperparameter tunings, and model leaderboard."
      icon={<FlaskConical className="w-6 h-6" />}
      targetTab="EXPERIMENTS"
    />
  );
}
