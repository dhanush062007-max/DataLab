import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { BrainCircuit } from "lucide-react";

export default function MachineLearningPage() {
  return (
    <DatasetSelector 
      title="Machine Learning Studio" 
      description="Select a dataset to train new models or view your past model experiments."
      icon={<BrainCircuit className="w-6 h-6" />}
      targetTab="ML"
    />
  );
}
