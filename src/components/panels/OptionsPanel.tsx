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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, FolderOutput } from "lucide-react";

interface OptionsPanelProps {
  analysis: {
    browseOutputDir: () => Promise<void>;
  };
}

export function OptionsPanel({ analysis }: OptionsPanelProps) {
  const {
    fastMatch, matchTolerance, outputDir, openAfterRun,
    setFastMatch, setMatchTolerance, setOutputDir, setOpenAfterRun,
  } = useAppStore();

  const handleBrowseOutput = async () => {
    await analysis.browseOutputDir();
  };

  return (
    <div className="space-y-4">
      {/* Matching Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap size={15} className="text-primary" />
            시간 매칭 옵션
          </CardTitle>
          <CardDescription className="text-xs">
            NPD-Track 시간 매칭 방식을 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Fast Time Matching</Label>
              <p className="text-[11px] text-muted-foreground">
                Tolerance 기반 필터링 활성화
              </p>
            </div>
            <Switch checked={fastMatch} onCheckedChange={setFastMatch} />
          </div>

          {fastMatch && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Tolerance (초)
              </Label>
              <Input
                type="number"
                value={matchTolerance}
                onChange={(e) => setMatchTolerance(e.target.value)}
                placeholder="예: 2.5"
                className="h-8 text-xs"
                step="0.1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderOutput size={15} className="text-primary" />
            출력 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">출력 폴더</Label>
            <div className="flex gap-2">
              <Input
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="결과 파일 저장 경로..."
                className="h-8 text-xs font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={handleBrowseOutput}
              >
                선택
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="autoOpen"
              checked={openAfterRun}
              onCheckedChange={(v) => setOpenAfterRun(v === true)}
            />
            <Label htmlFor="autoOpen" className="text-xs cursor-pointer">
              분석 완료 후 출력 폴더 자동 열기
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
