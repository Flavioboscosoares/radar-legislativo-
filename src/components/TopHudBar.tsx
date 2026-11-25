'use client';

import {
  Activity,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SUPPORTED_YEARS, type SupportedYear } from '@/data/brazil-ufs';
import type { MetricMode, TipoFilter } from '@/lib/camara/types';
import type { SnapshotStats } from '@/lib/timeline-utils';

interface TopHudBarProps {
  year: SupportedYear;
  onYearChange: (year: SupportedYear) => void;
  isLoading: boolean;
  tipoFilter: TipoFilter;
  onTipoFilterChange: (filter: TipoFilter) => void;
  metricMode: MetricMode;
  onMetricModeChange: (mode: MetricMode) => void;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
  isCheckingLive: boolean;
  lastLiveCheckedAt: string | null;
  liveNewCount: number;
  onCheckLiveNow: () => void;
  onReplayRecentSignals: () => void;
  stats: SnapshotStats;
}

export function TopHudBar({
  year,
  onYearChange,
  isLoading,
  tipoFilter,
  onTipoFilterChange,
  metricMode,
  onMetricModeChange,
  isLiveMode,
  onToggleLiveMode,
  isCheckingLive,
  lastLiveCheckedAt,
  liveNewCount,
  onCheckLiveNow,
  onReplayRecentSignals,
  stats,
}: TopHudBarProps) {
  return (
    <header className="z-20 border-b border-slate-800/80 bg-[#080D19]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        {/* Identidade + Seletor de Ano */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <Radio className="h-4.5 w-4.5" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-base font-bold tracking-tight text-slate-50 sm:text-lg">
                  Radar Legislativo
                </h1>
                <span className="hidden rounded border border-slate-700/80 bg-slate-800/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 sm:inline-block">
                  Câmara dos Deputados
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Produção de PL e PLP por UF do 1º signatário
              </p>
            </div>
          </div>

          {/* Anos */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5"
            role="group"
            aria-label="Selecionar ano"
          >
            {SUPPORTED_YEARS.map((y) => {
              const active = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => onYearChange(y)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs font-medium transition ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  {y}
                </button>
              );
            })}
            {isLoading && (
              <span className="px-2 text-cyan-400" title="Carregando dados da Câmara">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
            )}
          </div>
        </div>

        {/* Filtros + Ao Vivo */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Tipo */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs"
            role="group"
            aria-label="Filtrar tipo de proposição"
          >
            {(
              [
                { value: 'ALL', label: 'Todos' },
                { value: 'PL', label: 'PL' },
                { value: 'PLP', label: 'PLP' },
              ] as const
            ).map((opt) => {
              const active = tipoFilter === opt.value;
              const activeCls =
                opt.value === 'PLP'
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                  : 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40';
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTipoFilterChange(opt.value)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition ${
                    active
                      ? activeCls
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Métrica */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs"
            role="group"
            aria-label="Modo de métrica"
          >
            <button
              type="button"
              onClick={() => onMetricModeChange('ABSOLUTE')}
              className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition ${
                metricMode === 'ABSOLUTE'
                  ? 'bg-slate-700/80 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Absoluto
            </button>
            <button
              type="button"
              onClick={() => onMetricModeChange('PER_DEPUTY')}
              title="Divide o total de projetos pelo nº de deputados da bancada do estado"
              className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition ${
                metricMode === 'PER_DEPUTY'
                  ? 'bg-slate-700/80 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Por Deputado
            </button>
          </div>

          {/* Modo Ao Vivo */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleLiveMode}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isLiveMode
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.2)]'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {isLiveMode && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isLiveMode ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
              </span>
              Ao Vivo
              {isLiveMode && liveNewCount > 0 && (
                <span className="rounded bg-emerald-400/20 px-1 font-mono text-[10px] text-emerald-200">
                  +{liveNewCount}
                </span>
              )}
            </button>

            {isLiveMode && (
              <>
                <button
                  type="button"
                  onClick={onCheckLiveNow}
                  disabled={isCheckingLive}
                  title={
                    lastLiveCheckedAt
                      ? `Última verificação: ${lastLiveCheckedAt}. Clique para verificar agora.`
                      : 'Verificar novos projetos na Câmara agora'
                  }
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isCheckingLive ? 'animate-spin text-emerald-400' : ''}`}
                  />
                  <span className="hidden sm:inline">
                    {lastLiveCheckedAt ?? 'Checar'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onReplayRecentSignals}
                  title="Sinalizar no mapa os últimos 10 projetos apresentados"
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Sinais recentes</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPIs compactos */}
        <div className="flex items-center gap-3 border-t border-slate-800/70 pt-2 xl:border-t-0 xl:pt-0">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800/90 bg-slate-900/70 px-3 py-1">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Total até a data
              </div>
              <div className="font-mono text-sm font-bold tabular-nums text-slate-50">
                {stats.total.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-1">
            <div className="text-[10px] uppercase tracking-wider text-cyan-400/80">
              PL
            </div>
            <div className="font-mono text-sm font-bold tabular-nums text-cyan-300">
              {stats.totalPL.toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-1">
            <div className="text-[10px] uppercase tracking-wider text-amber-400/80">
              PLP
            </div>
            <div className="font-mono text-sm font-bold tabular-nums text-amber-300">
              {stats.totalPLP.toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="hidden rounded-lg border border-slate-800/90 bg-slate-900/70 px-3 py-1 sm:block">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              UF Líder
            </div>
            <div className="font-mono text-sm font-bold tabular-nums text-slate-100">
              {stats.leaderUf
                ? `${stats.leaderUf.uf} (${
                    metricMode === 'PER_DEPUTY'
                      ? stats.leaderUf.perDeputy.toFixed(1)
                      : stats.leaderUf.total.toLocaleString('pt-BR')
                  })`
                : '—'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
