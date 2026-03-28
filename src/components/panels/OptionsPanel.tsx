import { FolderOutput, ShieldCheck, Zap } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface OptionsPanelProps {
  analysis: {
    browseOutputDir: () => Promise<void>;
  };
}

export function OptionsPanel({ analysis }: OptionsPanelProps) {
  const {
    fastMatch,
    matchTolerance,
    outputDir,
    openAfterRun,
    resultsStale,
    setFastMatch,
    setMatchTolerance,
    setOutputDir,
    setOpenAfterRun,
  } = useAppStore();

  const matchingStory = fastMatch
    ? `Tolerance${matchTolerance ? ` ±${matchTolerance}s` : ""} 안에서 빠르게 매칭합니다. 누락된 NPD가 있을 수 있으므로 coverage 해석을 함께 보세요.`
    : "가장 가까운 Track 레코드에 정밀 매칭합니다. 속도는 느리지만 시간 축 coverage를 더 넓게 살핍니다.";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
      <div className="space-y-5">
        <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Zap size={15} className="text-primary" />
                  Matching policy
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  시간 매칭 정책은 line coverage와 신뢰도에 직접 영향을 줍니다.
                </CardDescription>
              </div>
              {resultsStale && (
                <Badge variant="outline" className="border-warning/35 bg-warning/10 text-warning">
                  Rerun required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => {
                  setFastMatch(false);
                  setMatchTolerance("");
                }}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  !fastMatch
                    ? "border-primary/35 bg-primary/10"
                    : "border-border/70 bg-background/35 hover:border-border hover:bg-background/55"
                }`}
              >
                <div className="text-sm font-medium text-foreground">Precise nearest match</div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  전체 Track 시간축에서 가장 가까운 레코드를 찾습니다. coverage를 먼저 확인하고
                  싶을 때 적합합니다.
                </p>
              </button>

              <button
                onClick={() => {
                  setFastMatch(true);
                  if (!matchTolerance) {
                    setMatchTolerance("2.5");
                  }
                }}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  fastMatch
                    ? "border-primary/35 bg-primary/10"
                    : "border-border/70 bg-background/35 hover:border-border hover:bg-background/55"
                }`}
              >
                <div className="text-sm font-medium text-foreground">Fast tolerance match</div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  tolerance 안의 후보만 빠르게 취급합니다. 반복 탐색과 대용량 line에서 속도가
                  중요할 때 유리합니다.
                </p>
              </button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Fast time matching</Label>
                  <p className="mt-1 text-sm text-foreground">{matchingStory}</p>
                </div>
                <Switch checked={fastMatch} onCheckedChange={setFastMatch} />
              </div>

              {fastMatch && (
                <div className="mt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">Tolerance (seconds)</Label>
                  <Input
                    type="number"
                    value={matchTolerance}
                    onChange={(event) => setMatchTolerance(event.target.value)}
                    placeholder="예: 2.5"
                    className="h-9 text-xs"
                    step="0.1"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/10">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FolderOutput size={15} className="text-primary" />
              Output policy
            </CardTitle>
            <CardDescription className="text-xs">
              저장 위치와 결과 확인 동작을 정합니다. 기존 사용자 데이터는 삭제하지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-2xl border border-border/70 bg-background/35 p-4">
              <Label className="text-xs text-muted-foreground">Output folder</Label>
              <div className="flex gap-2">
                <Input
                  value={outputDir}
                  onChange={(event) => setOutputDir(event.target.value)}
                  placeholder="비워두면 Track 파일 폴더를 사용합니다"
                  className="h-9 text-xs font-mono"
                />
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => void analysis.browseOutputDir()}>
                  선택
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/35 p-4">
              <Checkbox
                id="autoOpen"
                checked={openAfterRun}
                onCheckedChange={(value) => setOpenAfterRun(value === true)}
              />
              <div>
                <Label htmlFor="autoOpen" className="cursor-pointer text-sm">
                  분석 완료 후 출력 폴더 열기
                </Label>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  결과 package를 즉시 검토해야 할 때 유용합니다. 폴더만 열며 기존 파일을 삭제하지
                  않습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-5 self-start">
        <Card className="border-primary/20 bg-card/85">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={15} className="text-primary" />
              Interpretation impact
            </CardTitle>
            <CardDescription className="text-xs">
              옵션이 결과 해석에 어떤 흔적을 남기는지 미리 설명합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Matching
              </div>
              <p className="mt-2">{matchingStory}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Output
              </div>
              <p className="mt-2">
                결과는 지정 폴더에 CSV, charts, text report, PDF package로 남습니다. 분석 결과가
                오래되었다면 rerun 후 생성되는 산출물 이름과 line name을 함께 검토하세요.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
