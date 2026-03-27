import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, FileText, ArrowRight } from "lucide-react";

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
              Track File (Tab-separated)
            </h4>
            <pre className="rounded-md bg-muted p-3 text-[11px] font-mono leading-relaxed text-muted-foreground overflow-x-auto">
{`TRACENO  FFID  CHAN  SOU_X        SOU_Y         DAY  HOUR  MINUTE  SECOND
1        2001  1    523456.789   6234567.890   150  12    34      56.789`}
            </pre>
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
