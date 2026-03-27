import { useAppStore } from "@/stores/appStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Image, Table2, ExternalLink, FileDown } from "lucide-react";
import { FeatheringChart } from "@/components/charts/FeatheringChart";
import { TrackPlot } from "@/components/charts/TrackPlot";
import { HistogramChart } from "@/components/charts/HistogramChart";

interface ResultsPanelProps {
  analysis: {
    openFile: (path: string) => Promise<void>;
  };
}

const typeIcons: Record<string, React.ReactNode> = {
  CSV: <Table2 size={12} />,
  PNG: <Image size={12} />,
  TXT: <FileText size={12} />,
  PDF: <FileDown size={12} />,
  LOG: <FileText size={12} />,
};

const typeColors: Record<string, string> = {
  CSV: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  PNG: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  TXT: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  PDF: "bg-destructive/20 text-destructive border-destructive/30",
  LOG: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
};

export function ResultsPanel({ analysis }: ResultsPanelProps) {
  const resultFiles = useAppStore((s) => s.resultFiles);
  const stats = useAppStore((s) => s.stats);
  const chartData = useAppStore((s) => s.chartData);
  const featheringLimit = parseFloat(useAppStore((s) => s.featheringLimit) || "0");
  const runInM = parseFloat(useAppStore((s) => s.runInM) || "0");
  const runOutM = parseFloat(useAppStore((s) => s.runOutM) || "0");

  const handleOpenFile = (path: string) => {
    analysis.openFile(path);
  };

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Mean", value: `${stats.mean.toFixed(2)}°` },
            { label: "Std", value: `${stats.std.toFixed(2)}°` },
            { label: "Range", value: `${stats.range.toFixed(2)}°` },
            {
              label: "Exceeded",
              value: stats.exceeded_count > 0
                ? `${stats.exceeded_count} (${stats.exceeded_percent.toFixed(1)}%)`
                : "None",
            },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {chartData && (
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="feathering">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-2">
                <TabsTrigger value="feathering" className="text-xs">
                  Feathering Plot
                </TabsTrigger>
                <TabsTrigger value="track" className="text-xs">
                  Track Plot
                </TabsTrigger>
                <TabsTrigger value="histogram" className="text-xs">
                  Histogram
                </TabsTrigger>
              </TabsList>
              <TabsContent value="feathering" className="p-2">
                {stats && (
                  <FeatheringChart
                    data={chartData.points}
                    stats={stats}
                    featheringLimit={featheringLimit}
                    runInM={runInM}
                    runOutM={runOutM}
                  />
                )}
              </TabsContent>
              <TabsContent value="track" className="p-2">
                <TrackPlot
                  data={chartData.points}
                  featheringLimit={featheringLimit}
                />
              </TabsContent>
              <TabsContent value="histogram" className="p-2">
                <HistogramChart
                  data={chartData.points}
                  featheringLimit={featheringLimit}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Generated Files */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 size={15} className="text-primary" />
            생성된 파일
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resultFiles.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              분석 완료 후 결과 파일이 여기에 표시됩니다
            </p>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {resultFiles.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => handleOpenFile(file.path)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${typeColors[file.type] || ""}`}
                    >
                      {typeIcons[file.type]}
                      <span className="ml-1">{file.type}</span>
                    </Badge>
                    <span className="flex-1 truncate text-left font-mono">
                      {file.name}
                    </span>
                    <ExternalLink size={11} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
