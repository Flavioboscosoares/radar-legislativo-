'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useLegislativeTimeline } from '@/hooks/useLegislativeTimeline';
import { BrazilRadarMap } from './BrazilRadarMap';
import { SideTelemetryPanel } from './SideTelemetryPanel';
import { StateDetailDrawer } from './StateDetailDrawer';
import { TimelinePlayer } from './TimelinePlayer';
import { TopHudBar } from './TopHudBar';

export function PortalShell() {
  const timeline = useLegislativeTimeline(2026);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);

  const showCallouts = timeline.speed <= 3 || timeline.isLiveMode;

  return (
    <div className="radar-grid-bg flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <TopHudBar
        year={timeline.year}
        onYearChange={timeline.setYear}
        isLoading={timeline.isLoading}
        tipoFilter={timeline.tipoFilter}
        onTipoFilterChange={timeline.setTipoFilter}
        metricMode={timeline.metricMode}
        onMetricModeChange={timeline.setMetricMode}
        isLiveMode={timeline.isLiveMode}
        onToggleLiveMode={timeline.toggleLiveMode}
        isCheckingLive={timeline.isCheckingLive}
        lastLiveCheckedAt={timeline.lastLiveCheckedAt}
        liveNewCount={timeline.liveNewCount}
        onCheckLiveNow={timeline.checkLiveNow}
        onReplayRecentSignals={timeline.replayRecentSignals}
        stats={timeline.stats}
      />

      {/* Área central: Mapa + Telemetria */}
      <main className="mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-4 px-4 py-3 lg:min-h-0 lg:grid-cols-12 lg:px-6">
        {/* Mapa do Brasil */}
        <section className="relative flex min-h-[430px] flex-col rounded-2xl border border-slate-800/80 bg-[#080E1B]/70 p-2 backdrop-blur-sm lg:col-span-8 lg:min-h-0">
          {/* Status superior discreto dentro do mapa */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
            {timeline.isPlaying && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/70 px-2.5 py-0.5 font-mono text-[11px] text-cyan-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                SIMULANDO {timeline.speed}x
              </span>
            )}
            {timeline.isLiveMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-0.5 font-mono text-[11px] text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                MONITORAMENTO AO VIVO (60s)
              </span>
            )}
          </div>

          {timeline.error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="max-w-md text-sm text-slate-200">{timeline.error}</p>
              <button
                type="button"
                onClick={timeline.retryLoad}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          ) : timeline.isLoading && !timeline.dataset ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-sm font-medium text-slate-200">
                Sincronizando proposições de {timeline.year} na Câmara dos Deputados...
              </p>
              <p className="text-xs text-slate-400">
                Processando autores principais e UFs
              </p>
            </div>
          ) : (
            <BrazilRadarMap
              byUf={timeline.stats.byUf}
              maxMetricValue={timeline.stats.maxMetricValue}
              totalNational={timeline.stats.total}
              tipoFilter={timeline.tipoFilter}
              metricMode={timeline.metricMode}
              activeSignals={timeline.activeSignals}
              selectedUf={selectedUf}
              onSelectUf={setSelectedUf}
              showCallouts={showCallouts}
            />
          )}
        </section>

        {/* Painel lateral: Ranking + Feed */}
        <div className="lg:col-span-4 lg:min-h-0">
          <SideTelemetryPanel
            ranking={timeline.stats.ranking}
            maxMetricValue={timeline.stats.maxMetricValue}
            metricMode={timeline.metricMode}
            recentProjects={timeline.recentVisibleProjects}
            selectedUf={selectedUf}
            onSelectUf={setSelectedUf}
          />
        </div>
      </main>

      {/* Timeline inferior */}
      <TimelinePlayer
        year={timeline.year}
        calendarDays={timeline.calendarDays}
        dayIndex={timeline.dayIndex}
        currentDateKey={timeline.currentDateKey}
        dailyCounts={timeline.dataset?.dailyCounts ?? {}}
        tipoFilter={timeline.tipoFilter}
        isPlaying={timeline.isPlaying}
        speed={timeline.speed}
        onTogglePlay={timeline.togglePlay}
        onPlayFromJan1={timeline.playFromJan1}
        onResetToJan1={timeline.resetToJan1}
        onStepDay={timeline.stepDay}
        onSpeedChange={timeline.setSpeed}
        onSeekToDayIndex={timeline.seekToDayIndex}
      />

      {/* Nota metodológica discreta */}
      <footer className="border-t border-slate-900 bg-[#050810] px-4 py-1.5 text-center text-[11px] text-slate-500">
        Fonte: Dados Abertos da Câmara dos Deputados &amp; Malha Territorial IBGE •
        Contabiliza apenas PL e PLP apresentados no ano pelo 1º signatário com UF •
        Atalhos: Espaço (Play/Pause), ←/→ (±1 dia), R (01/Jan)
      </footer>

      <StateDetailDrawer
        uf={selectedUf}
        onClose={() => setSelectedUf(null)}
        projects={timeline.dataset?.projects ?? []}
        visibleEndIndex={timeline.visibleProjectsEndIndex}
        tipoFilter={timeline.tipoFilter}
        currentDateKey={timeline.currentDateKey}
        aggregate={selectedUf ? timeline.stats.byUf[selectedUf] : undefined}
      />
    </div>
  );
}
