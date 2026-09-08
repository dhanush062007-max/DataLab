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
        
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        // 1. Fetch EDA
        const edaRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/datasets/${datasetId}/eda`, {
          headers
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
    
    // Temporarily force desktop width so mobile exports look like A4 sheets
    const originalWidth = reportElement.style.width;
    const originalMaxWidth = reportElement.style.maxWidth;
    reportElement.style.width = "1024px";
    reportElement.style.maxWidth = "1024px";

    try {
      // Allow browser to re-paint the desktop width
      await new Promise((resolve) => setTimeout(resolve, 100));

      const domtoimage = (await import("dom-to-image-more")).default;
      const { jsPDF } = await import("jspdf");

      const scale = 2; // Double resolution for crystal clear text
      const imgData = await domtoimage.toPng(reportElement, {
        quality: 1,
        bgcolor: '#ffffff',
        width: reportElement.scrollWidth * scale,
        height: reportElement.scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${reportElement.scrollWidth}px`,
          height: `${reportElement.scrollHeight}px`,
        }
      });
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Calculate total scaled height of the image to fit A4 width
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      // First Page
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      // Additional Pages (if the report is tall)
      while (heightLeft > 0) {
        position -= pageHeight; // Shift the drawing coordinate up by one page
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${datasetName}_Report.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      // Restore original mobile layout
      reportElement.style.width = originalWidth;
      reportElement.style.maxWidth = originalMaxWidth;
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
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-xl p-6 print:hidden shadow-sm">
        <div className="min-w-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            Report Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1 break-words">Review the automated summary below, then print or save as PDF.</p>
        </div>
        <Button onClick={handlePrint} disabled={exporting} className="flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0">
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 border-b border-gray-200 pb-6 min-w-0">
          <div className="min-w-0 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">Data Analysis Report</h1>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-600 break-words">{datasetName}</h2>
          </div>
          <div className="text-left sm:text-right text-sm text-gray-500">
            <div className="flex items-center sm:justify-end gap-1 mb-1">
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
                      <td className="py-2 px-3 font-medium text-gray-900 break-all min-w-[120px] max-w-[200px]">{col.name}</td>
                      <td className="py-2 px-3 text-gray-600">{col.type}</td>
                      <td className="py-2 px-3">
                        <span className={col.null_count > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                          {col.null_percentage}% ({col.null_count})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs break-all max-w-[250px]">
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
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-bold text-gray-900 min-w-0 break-words">{test.test_type.replace(/_/g, ' ').toUpperCase()}</h4>
                    <span className={`shrink-0 whitespace-nowrap text-xs px-2 py-1 rounded-full font-bold ${test.p_value < 0.05 ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                      p = {test.p_value?.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 break-words mt-2">
                    <span className="font-semibold shrink-0">Variables:</span> <span className="break-all">{test.variable_a}</span> {test.variable_b ? <>& <span className="break-all">{test.variable_b}</span></> : ''}
                  </p>
                  <p className="text-sm mt-2 font-medium text-gray-900 bg-white p-2 rounded border border-gray-100 break-words">
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
                const isClassification = model.algorithm && (model.algorithm.includes("CLASSIFIER") || model.algorithm.includes("LOGISTIC"));
                return (
                  <div key={model.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm min-w-0 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="font-bold text-gray-900 truncate min-w-0" title={model.model_type}>{model.model_type}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                        {isClassification ? 'Classification' : 'Regression'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3 flex items-center gap-1 min-w-0">
                      <span className="shrink-0">Target:</span> <span className="font-semibold truncate">{model.target_column}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {isClassification ? (
                        <>
                          <div className="bg-gray-50 p-2 rounded min-w-0">
                            <div className="text-gray-500 text-xs truncate">Accuracy</div>
                            <div className="font-bold text-gray-900 truncate">{(model.metrics.accuracy * 100).toFixed(1)}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded min-w-0">
                            <div className="text-gray-500 text-xs truncate">F1 Score</div>
                            <div className="font-bold text-gray-900 truncate">{(model.metrics.f1_score * 100).toFixed(1)}%</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-50 p-2 rounded min-w-0">
                            <div className="text-gray-500 text-xs truncate">R² Score</div>
                            <div className="font-bold text-gray-900 truncate">{model.metrics.r2?.toFixed(3)}</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded min-w-0">
                            <div className="text-gray-500 text-xs truncate">RMSE</div>
                            <div className="font-bold text-gray-900 truncate">{model.metrics.rmse?.toFixed(3)}</div>
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
