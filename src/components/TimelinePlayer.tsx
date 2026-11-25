'use client';

import { useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { DailyCount, TipoFilter } from '@/lib/camara/types';
import { formatDateHud } from '@/lib/timeline-utils';
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from '@/hooks/useLegislativeTimeline';

interface TimelinePlayerProps {
  year: number;
  calendarDays: string[];
  dayIndex: number;
  currentDateKey: string;
  dailyCounts: Record<string, DailyCount>;
  tipoFilter: TipoFilter;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  onTogglePlay: () => void;
  onPlayFromJan1: () => void;
  onResetToJan1: () => void;
  onStepDay: (delta: number) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onSeekToDayIndex: (index: number) => void;
}

const MONTH_LABELS = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

export function TimelinePlayer({
  year,
  calendarDays,
  dayIndex,
  currentDateKey,
  dailyCounts,
  tipoFilter,
  isPlaying,
  speed,
  onTogglePlay,
  onPlayFromJan1,
  onResetToJan1,
  onStepDay,
  onSpeedChange,
  onSeekToDayIndex,
}: TimelinePlayerProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const { dayTotals, maxDayTotal, monthTicks } = useMemo(() => {
    let maxVal = 1;
    const totals = calendarDays.map((key) => {
      const c = dailyCounts[key];
      if (!c) return { pl: 0, plp: 0, total: 0 };
      const pl = tipoFilter === 'PLP' ? 0 : c.pl;
      const plp = tipoFilter === 'PL' ? 0 : c.plp;
      const total = pl + plp;
      if (total > maxVal) maxVal = total;
      return { pl, plp, total };
    });

    const ticks: Array<{ label: string; pct: number }> = [];
    const seenMonths = new Set<string>();
    const denom = Math.max(1, calendarDays.length - 1);
    calendarDays.forEach((key, idx) => {
      const mm = key.slice(5, 7);
      if (!seenMonths.has(mm)) {
        seenMonths.add(mm);
        const mIdx = Number(mm) - 1;
        ticks.push({
          label: MONTH_LABELS[mIdx] ?? mm,
          pct: (idx / denom) * 100,
        });
      }
    });

    return { dayTotals: totals, maxDayTotal: maxVal, monthTicks: ticks };
  }, [calendarDays, dailyCounts, tipoFilter]);

  const progressPct =
    calendarDays.length > 1
      ? (dayIndex / (calendarDays.length - 1)) * 100
      : 0;

  const seekFromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el || calendarDays.length <= 1) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (calendarDays.length - 1));
    onSeekToDayIndex(idx);
  };

  const todayCount = dailyCounts[currentDateKey];
  const todayPl = tipoFilter === 'PLP' ? 0 : (todayCount?.pl ?? 0);
  const todayPlp = tipoFilter === 'PL' ? 0 : (todayCount?.plp ?? 0);

  return (
    <section
      aria-label="Linha do tempo anual"
      className="z-20 border-t border-slate-800/80 bg-[#080D19]/92 px-4 py-3 backdrop-blur-md lg:px-6"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2.5">
        {/* Linha de controles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={onTogglePlay}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition hover:bg-cyan-400"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {dayIndex >= calendarDays.length - 1 ? 'Play de 01/Jan' : 'Play'}
                </>
              )}
            </button>

            {/* Botão dedicado para iniciar do 1º de janeiro */}
            <button
              type="button"
              onClick={onPlayFromJan1}
              title={`Reproduzir a partir de 01/01/${year}`}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desde 01/Jan</span>
            </button>

            <button
              type="button"
              onClick={onResetToJan1}
              title={`Posicionar em 01/01/${year}`}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              01/Jan
            </button>

            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90">
              <button
                type="button"
                onClick={() => onStepDay(-1)}
                disabled={dayIndex <= 0}
                title="Dia anterior (seta esquerda)"
                className="cursor-pointer p-1.5 text-slate-300 transition hover:text-white disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="h-4 w-px bg-slate-800" />
              <button
                type="button"
                onClick={() => onStepDay(1)}
                disabled={dayIndex >= calendarDays.length - 1}
                title="Próximo dia (seta direita)"
                className="cursor-pointer p-1.5 text-slate-300 transition hover:text-white disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Velocidade */}
            <div
              className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5"
              role="group"
              aria-label="Velocidade da timeline"
            >
              {PLAYBACK_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSpeedChange(spd)}
                  className={`cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] font-medium transition ${
                    speed === spd
                      ? 'bg-slate-700 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Leitor de Data e Produção do Dia */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1 font-mono text-[11px] sm:flex">
              <span className="text-slate-400">No dia:</span>
              <span className="text-cyan-300">{todayPl} PL</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300">{todayPlp} PLP</span>
            </div>

            <div className="rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-1 font-mono text-sm font-bold tracking-wide text-slate-50 shadow-inner">
              {formatDateHud(currentDateKey)}
            </div>
          </div>
        </div>

        {/* Scrubber com Histograma Diário */}
        <div className="relative pt-1">
          <div
            ref={trackRef}
            onPointerDown={(e) => {
              isDraggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (!isDraggingRef.current) return;
              seekFromPointer(e.clientX);
            }}
            onPointerUp={() => {
              isDraggingRef.current = false;
            }}
            className="relative h-12 w-full cursor-pointer select-none overflow-hidden rounded-lg border border-slate-800/90 bg-slate-950/80 px-0.5 pt-1.5"
          >
            {/* Barras diárias (sparkline) */}
            <div className="flex h-full w-full items-end gap-[1px]">
              {dayTotals.map((day, idx) => {
                const passed = idx <= dayIndex;
                const heightPct =
                  day.total > 0
                    ? Math.max(8, Math.round((day.total / maxDayTotal) * 100))
                    : 0;
                const plPortion =
                  day.total > 0 ? Math.round((day.pl / day.total) * 100) : 0;

                return (
                  <div
                    key={calendarDays[idx]}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    {heightPct > 0 && (
                      <div
                        className="w-full overflow-hidden rounded-t-[1px] transition-opacity duration-100"
                        style={{
                          height: `${heightPct}%`,
                          opacity: passed ? 0.95 : 0.25,
                        }}
                      >
                        <div
                          className="w-full bg-amber-400"
                          style={{ height: `${100 - plPortion}%` }}
                        />
                        <div
                          className="w-full bg-cyan-400"
                          style={{ height: `${plPortion}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Agulha da posição atual */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_#fff]"
              style={{ left: `${progressPct}%` }}
            >
              <div className="absolute -left-1.5 top-0 h-2.5 w-3.5 rounded-b bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            </div>
          </div>

          {/* Marcadores de meses */}
          <div className="relative mt-1 h-4 w-full">
            {monthTicks.map((tick) => (
              <span
                key={tick.label}
                className="absolute -translate-x-1/2 font-mono text-[10px] text-slate-500 first:translate-x-0"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
