"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FileText, Download, Loader2, AlertCircle, Calendar, Target, BrainCircuit, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportGeneratorProps {
  datasetId: string;
  datasetName: string;
}

export function ReportGenerator({ datasetId, datasetName }: ReportGeneratorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [edaStats, setEdaStats] = useState<any>(null);
  const [mlModels, setMlModels] = useState<any[]>([]);
  const [statsTests, setStatsTests] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchReportData() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        // 1. Fetch EDA
        const edaRes = await fetch(`http://localhost:8000/api/v1/datasets/${datasetId}/eda`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        if (edaRes.ok) {
          const edaData = await edaRes.json();
          setEdaStats(edaData);
        }

        // 2. Fetch ML Models
        const { data: mlData } = await supabase
          .from("ml_experiments")
          .select("*")
          .eq("dataset_id", datasetId)
          .order("created_at", { ascending: false })
          .limit(5);
        if (mlData) setMlModels(mlData);

        // 3. Fetch Statistical Tests
        const { data: statsData } = await supabase
          .from("statistical_tests")
          .select("*")
          .eq("dataset_id", datasetId)
          .order("created_at", { ascending: false })
          .limit(5);
        if (statsData) setStatsTests(statsData);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, [datasetId]);

  const handlePrint = async () => {
    const reportElement = document.getElementById("printable-report");
    if (!reportElement) return;

    setExporting(true);

    try {
      const domtoimage = (await import("dom-to-image-more")).default;
      const { jsPDF } = await import("jspdf");

      // We use dom-to-image-more to bypass html2canvas's CSS parsing limits (e.g. oklch/lab colors)
      const imgData = await domtoimage.toPng(reportElement, {
        quality: 1,
        bgcolor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Get image dimensions to scale it correctly
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${datasetName}_Report.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Gathering insights and generating report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card border border-border rounded-xl p-6 print:hidden shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Report Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Review the automated summary below, then print or save as PDF.</p>
        </div>
        <Button onClick={handlePrint} disabled={exporting} className="flex items-center gap-2 shadow-lg shadow-primary/20">
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" /> Export PDF
            </>
          )}
        </Button>
      </div>

      {/* The Printable Report Container */}
      <div id="printable-report" className="bg-white text-black print:text-black border border-border rounded-xl p-10 print:p-0 print:border-none shadow-sm print:shadow-none min-h-[800px] mx-auto max-w-5xl">
        
        {/* Report Header */}
        <div className="border-b-2 border-gray-200 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">DataLab Report</h1>
            <h2 className="text-2xl font-semibold text-gray-600">{datasetName}</h2>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="flex items-center justify-end gap-1 mb-1">
              <Calendar className="w-4 h-4" /> {new Date().toLocaleDateString()}
            </div>
            <div>Generated automatically via DataLab</div>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="mb-10">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Target className="w-5 h-5 text-blue-600" /> Executive Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-500 font-medium">Total Records</div>
              <div className="text-2xl font-bold text-gray-900">{edaStats?.total_rows || 0}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-500 font-medium">Total Features</div>
              <div className="text-2xl font-bold text-gray-900">{edaStats?.columns?.length || 0}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-500 font-medium">Trained Models</div>
              <div className="text-2xl font-bold text-gray-900">{mlModels.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-500 font-medium">Hypothesis Tests</div>
              <div className="text-2xl font-bold text-gray-900">{statsTests.length}</div>
            </div>
          </div>
        </section>

        {/* Data Quality */}
        {edaStats && (
          <section className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Data Quality & Features</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3 rounded-tl-md">Feature Name</th>
                    <th className="py-2 px-3">Data Type</th>
                    <th className="py-2 px-3">Missing Values</th>
                    <th className="py-2 px-3 rounded-tr-md">Key Stats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {edaStats.columns.map((col: any) => (
                    <tr key={col.name} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{col.name}</td>
                      <td className="py-2 px-3 text-gray-600">{col.type}</td>
                      <td className="py-2 px-3">
                        <span className={col.null_count > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                          {col.null_percentage}% ({col.null_count})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {col.is_numeric ? `Mean: ${col.mean?.toFixed(2) || 'N/A'}, Min: ${col.min?.toFixed(2) || 'N/A'}` : `Categories: ${col.top_categories?.length || 0}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Statistical Findings */}
        {statsTests.length > 0 && (
          <section className="mb-10 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
              <Calculator className="w-5 h-5 text-purple-600" /> Statistical Findings
            </h3>
            <div className="space-y-4">
              {statsTests.map((test) => (
                <div key={test.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900">{test.test_type.replace(/_/g, ' ').toUpperCase()}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${test.p_value < 0.05 ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                      p = {test.p_value?.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Variables:</span> {test.variable_a} {test.variable_b ? `& ${test.variable_b}` : ''}
                  </p>
                  <p className="text-sm mt-2 font-medium text-gray-900 bg-white p-2 rounded border border-gray-100">
                    {test.interpretation}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Machine Learning Models */}
        {mlModels.length > 0 && (
          <section className="mb-10 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
              <BrainCircuit className="w-5 h-5 text-emerald-600" /> Predictive Models (Top 5)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {mlModels.map((model) => {
                const isClassification = model.task_type === "CLASSIFICATION";
                return (
                  <div key={model.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-900 truncate" title={model.model_type}>{model.model_type}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                        {isClassification ? 'Classification' : 'Regression'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      Target: <span className="font-semibold">{model.target_column}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {isClassification ? (
                        <>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-gray-500 text-xs">Accuracy</div>
                            <div className="font-bold text-gray-900">{(model.metrics.accuracy * 100).toFixed(1)}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-gray-500 text-xs">F1 Score</div>
                            <div className="font-bold text-gray-900">{(model.metrics.f1_score * 100).toFixed(1)}%</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-gray-500 text-xs">R² Score</div>
                            <div className="font-bold text-gray-900">{model.metrics.r2?.toFixed(3)}</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-gray-500 text-xs">RMSE</div>
                            <div className="font-bold text-gray-900">{model.metrics.rmse?.toFixed(3)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-200 text-center text-sm text-gray-400">
          End of Report - Generated by DataLab
        </div>

      </div>
    </div>
  );
}
