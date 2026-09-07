import { DatasetSelector } from "@/components/shared/DatasetSelector";
import { Link as LinkIcon } from "lucide-react";

export default function CollectionPage() {
  return (
    <DatasetSelector 
      title="Data Collection" 
      description="Select a dataset to manage its public data collection form."
      icon={<LinkIcon className="w-6 h-6" />}
      targetTab="COLLECTION"
    />
  );
}
