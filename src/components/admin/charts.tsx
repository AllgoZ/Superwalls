import { cn } from "@/lib/utils";

export interface ChartPoint {
  label: string;
  value: number;
  /** Optional second line for the hover title. */
  hint?: string;
}

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

function xLabels(points: ChartPoint[]): { index: number; text: string }[] {
  if (points.length <= 1) return points.map((p, index) => ({ index, text: p.label }));
  const wanted = Math.min(points.length, 6);
  const picked = new Set<number>();
  for (let i = 0; i < wanted; i++) picked.add(Math.round((i * (points.length - 1)) / (wanted - 1)));
  return [...picked].map((index) => ({ index, text: points[index]!.label }));
}

/** Hand-drawn SVG so the admin ships no chart library. Values are plain numbers; `format` shows them as money, counts, etc. */
export function BarChart({ points, format, ariaLabel, className }: { points: ChartPoint[]; format: (value: number) => string; ariaLabel: string; className?: string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const empty = points.every((p) => p.value === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={cn("h-auto w-full", className)}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * (1 - t)} y2={PAD.top + innerH * (1 - t)} stroke="currentColor" className="text-border" strokeDasharray={t === 0 ? undefined : "3 4"} />
        </g>
      ))}
      <text x={W - PAD.right} y={PAD.top - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {format(max)}
      </text>
      {points.map((p, i) => {
        const h = (p.value / max) * innerH;
        const x = PAD.left + slot * i + (slot - barW) / 2;
        return (
          <g key={`${p.label}-${i}`}>
            <rect x={x} y={PAD.top + innerH - h} width={barW} height={Math.max(h, p.value > 0 ? 1 : 0)} rx={2} className="fill-primary">
              <title>{`${p.label}: ${format(p.value)}${p.hint ? ` (${p.hint})` : ""}`}</title>
            </rect>
          </g>
        );
      })}
      {xLabels(points).map(({ index, text }) => (
        <text key={index} x={PAD.left + slot * index + slot / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {text}
        </text>
      ))}
      {empty ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted-foreground text-xs">
          No data for this period
        </text>
      ) : null}
    </svg>
  );
}

export function LineChart({ points, format, ariaLabel, className }: { points: ChartPoint[]; format: (value: number) => string; ariaLabel: string; className?: string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xy = points.map((p, i) => [PAD.left + (points.length > 1 ? step * i : innerW / 2), PAD.top + innerH - (p.value / max) * innerH] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = xy.length > 0 ? `${line} L${xy.at(-1)![0].toFixed(1)},${PAD.top + innerH} L${xy[0]![0].toFixed(1)},${PAD.top + innerH} Z` : "";
  const empty = points.every((p) => p.value === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={cn("h-auto w-full", className)}>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * (1 - t)} y2={PAD.top + innerH * (1 - t)} stroke="currentColor" className="text-border" strokeDasharray={t === 0 ? undefined : "3 4"} />
      ))}
      <text x={W - PAD.right} y={PAD.top - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {format(max)}
      </text>
      {area ? <path d={area} className="fill-primary/10" /> : null}
      {line ? <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-primary" /> : null}
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={points.length > 40 ? 0 : 3} className="fill-primary">
          <title>{`${points[i]!.label}: ${format(points[i]!.value)}`}</title>
        </circle>
      ))}
      {xLabels(points).map(({ index, text }) => (
        <text key={index} x={xy[index]?.[0] ?? 0} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {text}
        </text>
      ))}
      {empty ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted-foreground text-xs">
          No data for this period
        </text>
      ) : null}
    </svg>
  );
}
