import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalysisSummary, FeatheringStats } from "@/types";

function formatAngle(value: number): string {
  return `${value.toFixed(2)}\u00B0`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function nowKST(): string {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface ReportParams {
  stats: FeatheringStats;
  summary: AnalysisSummary;
  lineName: string;
  featheringLimit: number;
  plannedAzimuth: string;
  headPosition: string;
  tailPosition: string;
  npdPath: string;
  trackPath: string;
}

export function generateFeatheringPDF(params: ReportParams): jsPDF {
  const { stats, summary, lineName, featheringLimit, plannedAzimuth } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header bar
  doc.setFillColor(15, 118, 110); // teal-700
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Feathering Analysis Report", 14, 14);
  doc.setFontSize(9);
  doc.text(`Line: ${lineName || "N/A"}  |  Generated: ${nowKST()}`, 14, 22);
  doc.setTextColor(0, 0, 0);

  y = 36;

  // Verdict badge
  const verdictColors: Record<string, [number, number, number]> = {
    PASS: [34, 197, 94],
    WARN: [245, 158, 11],
    FAIL: [239, 68, 68],
    INFO: [59, 130, 246],
  };
  const vc = verdictColors[summary.verdict] || [100, 100, 100];
  doc.setFillColor(vc[0], vc[1], vc[2]);
  doc.roundedRect(14, y, 28, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(summary.verdict, 28, y + 6.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(12);
  doc.text(summary.headline, 46, y + 6.5);
  y += 14;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const detailLines = doc.splitTextToSize(summary.detail, pageWidth - 28);
  doc.text(detailLines, 14, y);
  y += detailLines.length * 4.5 + 6;
  doc.setTextColor(0, 0, 0);

  // Main statistics table
  doc.setFontSize(11);
  doc.text("Statistics Summary", 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Metric", "Value"]],
    body: [
      ["Mean Feathering", formatAngle(stats.mean)],
      ["Std Deviation", formatAngle(stats.std)],
      ["Min", formatAngle(stats.min)],
      ["Max", formatAngle(stats.max)],
      ["Range", formatAngle(stats.range)],
      ["Total Records", stats.total_records.toLocaleString()],
      ["Planned Azimuth", `${plannedAzimuth}\u00B0`],
      [
        "Feathering Limit",
        featheringLimit > 0 ? `\u00B1${featheringLimit}\u00B0` : "Not set",
      ],
      [
        "Exceeded Count",
        featheringLimit > 0
          ? `${stats.exceeded_count.toLocaleString()} (${formatPercent(stats.exceeded_percent)})`
          : "N/A",
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], fontSize: 9, font: "helvetica" },
    bodyStyles: { fontSize: 9, font: "helvetica" },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Main-line analysis window
  doc.setFontSize(11);
  doc.text("Analysis Window", 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Parameter", "Value"]],
    body: [
      ["Total Records", summary.window.total_records.toLocaleString()],
      ["Included Records", summary.window.included_records.toLocaleString()],
      ["Excluded Records", summary.window.excluded_records.toLocaleString()],
      [
        "FFID Range",
        `${summary.window.first_ffid?.toLocaleString() ?? "N/A"} \u2192 ${summary.window.last_ffid?.toLocaleString() ?? "N/A"}`,
      ],
      [
        "Total Distance",
        `${summary.window.total_distance_m.toLocaleString()} m`,
      ],
      [
        "Included Distance",
        `${summary.window.included_distance_m.toLocaleString()} m`,
      ],
      ["Matching Mode", summary.matching.mode === "fast" ? "Fast tolerance" : "Precise nearest"],
      ["Match Coverage", formatPercent(summary.matching.matched_percent)],
      ["Head Position", params.headPosition],
      ["Tail Position", params.tailPosition],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], fontSize: 9, font: "helvetica" },
    bodyStyles: { fontSize: 9, font: "helvetica" },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Peak excursions
  if (summary.peaks.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(11);
    doc.text("Peak Excursions", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["FFID", "Feathering", "Zone", "Exceeded"]],
      body: summary.peaks.map((p) => [
        p.ffid.toLocaleString(),
        formatAngle(p.feathering),
        p.zone.replace("_", " "),
        p.exceeded ? "YES" : "NO",
      ]),
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110], fontSize: 9, font: "helvetica" },
      bodyStyles: { fontSize: 9, font: "helvetica" },
      alternateRowStyles: { fillColor: [245, 248, 250] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Change zones
  if (summary.changes.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(11);
    doc.text("Change Zones", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["FFID Range", "Type", "Peak Abs", "Mean Shift", "Records"]],
      body: summary.changes.map((c) => [
        `${c.start_ffid.toLocaleString()} \u2192 ${c.end_ffid.toLocaleString()}`,
        c.detection_type,
        formatAngle(c.peak_abs),
        formatAngle(c.mean_shift),
        c.record_count.toLocaleString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110], fontSize: 9, font: "helvetica" },
      bodyStyles: { fontSize: 9, font: "helvetica" },
      alternateRowStyles: { fillColor: [245, 248, 250] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Source files
  if (y > 250) {
    doc.addPage();
    y = 15;
  }
  doc.setFontSize(11);
  doc.text("Source Files", 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`NPD: ${params.npdPath}`, 14, y);
  y += 4;
  doc.text(`Track: ${params.trackPath}`, 14, y);
  y += 8;

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Feathering Analysis Report  |  Page ${i}/${totalPages}  |  GeoView`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  return doc;
}
