import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileDropZone } from "@/components/FileDropZone";
import {
  FolderOpen,
  FileSearch,
  Compass,
  Ruler,
  ArrowRightLeft,
  CheckCircle2,
  Wand2,
  Loader2,
} from "lucide-react";

interface InputPanelProps {
  analysis: {
    browseFile: (field: "npdPath" | "trackPath", title: string) => Promise<void>;
    scanHeaders: (path: string) => Promise<void>;
    estimateAzimuth: () => Promise<void>;
  };
}

export function InputPanel({ analysis }: InputPanelProps) {
  const {
    npdPath, trackPath, lineName,
    plannedAzimuth, featheringLimit, runInM, runOutM,
    npdHeaders, headPosition, tailPosition,
    isRunning,
    setField, setHeadPosition, setTailPosition,
  } = useAppStore();

  const [estimating, setEstimating] = useState(false);

  const handleEstimate = async () => {
    setEstimating(true);
    try {
      await analysis.estimateAzimuth();
    } finally {
      // 응답은 비동기로 오므로 2초 후 해제 (응답이 오면 더 빨리 해제됨)
      setTimeout(() => setEstimating(false), 3000);
    }
  };

  const handleBrowse = async (field: "npdPath" | "trackPath") => {
    const title = field === "npdPath" ? "NPD 파일 선택" : "Track 파일 선택";
    await analysis.browseFile(field, title);
  };

  const handleFileDrop = (field: "npdPath" | "trackPath") => (path: string) => {
    setField(field, path);
    if (field === "npdPath") {
      analysis.scanHeaders(path);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* File Selection */}
      <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSearch size={15} className="text-primary" />
            파일 선택
          </CardTitle>
          <CardDescription className="text-xs">
            NPD 파일과 Track 파일을 선택하거나 드래그하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* NPD File */}
          <FileDropZone onFileDrop={handleFileDrop("npdPath")}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="npd" className="text-xs text-muted-foreground">
                  NPD File
                </Label>
                {npdPath && (
                  <CheckCircle2 size={12} className="text-success" />
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="npd"
                  value={npdPath}
                  onChange={(e) => setField("npdPath", e.target.value)}
                  placeholder="파일을 드래그하거나 선택하세요..."
                  className="h-8 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 transition-colors"
                  onClick={() => handleBrowse("npdPath")}
                >
                  <FolderOpen size={13} className="mr-1" />
                  선택
                </Button>
              </div>
            </div>
          </FileDropZone>

          {/* Track File */}
          <FileDropZone onFileDrop={handleFileDrop("trackPath")}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="track" className="text-xs text-muted-foreground">
                  Track File
                </Label>
                {trackPath && (
                  <CheckCircle2 size={12} className="text-success" />
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="track"
                  value={trackPath}
                  onChange={(e) => setField("trackPath", e.target.value)}
                  placeholder="파일을 드래그하거나 선택하세요..."
                  className="h-8 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 transition-colors"
                  onClick={() => handleBrowse("trackPath")}
                >
                  <FolderOpen size={13} className="mr-1" />
                  선택
                </Button>
              </div>
            </div>
          </FileDropZone>

          {/* Line Name */}
          <div className="space-y-1.5">
            <Label htmlFor="lineName" className="text-xs text-muted-foreground">
              Line Name
            </Label>
            <Input
              id="lineName"
              value={lineName}
              onChange={(e) => setField("lineName", e.target.value)}
              placeholder="자동 감지 (Track 파일명 기반)"
              className="h-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* NPD Position Headers */}
      {npdHeaders.length > 0 && (
        <Card className="animate-in slide-in-from-top-2 duration-300 transition-shadow hover:shadow-lg hover:shadow-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft size={15} className="text-primary" />
                Position 헤더
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-success border-success/30">
                {npdHeaders.length}개 감지
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Head/Tail 위치를 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Head Position</Label>
                <Select value={headPosition} onValueChange={(v) => v && setHeadPosition(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {npdHeaders.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tail Position</Label>
                <Select value={tailPosition} onValueChange={(v) => v && setTailPosition(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {npdHeaders.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Compass size={15} className="text-primary" />
            분석 파라미터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="azimuth" className="text-xs text-muted-foreground">
                Planned Azimuth (°)
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="azimuth"
                  type="number"
                  value={plannedAzimuth}
                  onChange={(e) => setField("plannedAzimuth", e.target.value)}
                  placeholder="0 ~ 360"
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-2"
                  onClick={handleEstimate}
                  disabled={!trackPath || isRunning || estimating}
                  title="Track 데이터에서 방위각 자동 추정"
                >
                  {estimating ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Wand2 size={13} />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit" className="text-xs text-muted-foreground">
                Feathering Limit (°)
              </Label>
              <Input
                id="limit"
                type="number"
                value={featheringLimit}
                onChange={(e) => setField("featheringLimit", e.target.value)}
                placeholder="0 = 없음"
                className="h-8 text-xs"
              />
            </div>

            <Separator className="col-span-2" />

            <div className="space-y-1.5">
              <Label htmlFor="runIn" className="text-xs text-muted-foreground flex items-center gap-1">
                <Ruler size={11} />
                Run-in (m)
              </Label>
              <Input
                id="runIn"
                type="number"
                value={runInM}
                onChange={(e) => setField("runInM", e.target.value)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="runOut" className="text-xs text-muted-foreground flex items-center gap-1">
                <Ruler size={11} />
                Run-out (m)
              </Label>
              <Input
                id="runOut"
                type="number"
                value={runOutM}
                onChange={(e) => setField("runOutM", e.target.value)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
