import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { MessageSquare } from "lucide-react";

export default function NLPPage() {
  return (
    <DatasetSelector 
      title="Natural Language Processing" 
      description="Select a dataset to perform text analysis, topic modeling, and sentiment distribution."
      icon={<MessageSquare className="w-6 h-6" />}
      targetTab="NLP"
    />
  );
}
