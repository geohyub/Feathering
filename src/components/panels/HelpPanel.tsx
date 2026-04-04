import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, FileText, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TRACK_FORMAT_HINT } from "@/lib/trackFormat";

export function HelpPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HelpCircle size={15} className="text-primary" />
            입력 파일 형식
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-1.5 text-xs font-medium flex items-center gap-1.5">
              <FileText size={12} className="text-chart-1" />
              NPD File
            </h4>
            <pre className="rounded-md bg-muted p-3 text-[11px] font-mono leading-relaxed text-muted-foreground overflow-x-auto">
{`Time, D, Position: Head_Buoy: X: East, Position: Head_Buoy: X: North, ...
12:34:56.789, 1, 523456.789, 6234567.890, ...`}
            </pre>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs font-medium flex items-center gap-1.5">
              <FileText size={12} className="text-chart-2" />
              Track File
            </h4>
            <div className="rounded-md border border-border/70 bg-muted p-3 text-[11px] leading-5 text-muted-foreground">
              <div className="mb-2 flex items-center gap-1.5 text-foreground">
                <CheckCircle2 size={12} className="text-success" />
                지원: tab-separated survey track
              </div>
              <pre className="overflow-x-auto font-mono leading-relaxed text-muted-foreground">
{`TRACENO\tFFID\tCHAN\tSOU_X\tSOU_Y\tDAY\tHOUR\tMINUTE\tSECOND
1\t2001\t1\t523456.789\t6234567.890\t150\t12\t34\t56.789`}
              </pre>
              <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-warning">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>raw GPGGA / NMEA nav 로그는 직접 사용할 수 없습니다. 먼저 survey track으로 변환해 주세요.</span>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-background/35 p-3 text-[11px] leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">왜 필요한가?</span> Feathering은 NPD와
            Track을 시간으로 맞춘 뒤, 실제 streamer 방향을 계산합니다. 그래서 Track은
            탐지용 nav 로그가 아니라 바로 매칭 가능한 survey track이어야 합니다.
          </div>
          <div className="rounded-md border border-border/70 bg-background/35 p-3 text-[11px] leading-5 text-muted-foreground">
            {TRACK_FORMAT_HINT}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="text-primary" />
            입력이 막히는 경우
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs leading-5 text-muted-foreground">
          <div className="rounded-md border border-border/70 bg-background/35 p-3">
            <span className="font-medium text-foreground">원인</span>: 원시 GPGGA / NMEA nav 로그,
            쉼표 구분 파일, 헤더가 없는 로그는 바로 읽지 못합니다.
          </div>
          <div className="rounded-md border border-border/70 bg-background/35 p-3">
            <span className="font-medium text-foreground">준비 방법</span>: 탭으로 구분된 survey
            track으로 다시 내보내세요. 필요하면 track export 또는 변환 단계를 먼저 거친 뒤
            Feathering에 넣으면 됩니다.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowRight size={15} className="text-primary" />
            분석 워크플로우
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { step: "1", desc: "NPD/Track 파일 선택 및 파라미터 입력" },
              { step: "2", desc: "NPD 헤더 스캔 → Head/Tail Position 선택" },
              { step: "3", desc: "분석 실행 (시간 매칭 → Feathering 계산)" },
              { step: "4", desc: "결과 확인: 차트, CSV, 보고서 자동 생성" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {item.step}
                </span>
                <span className="text-xs text-muted-foreground leading-5">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
