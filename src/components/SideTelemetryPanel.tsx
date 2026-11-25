'use client';

import { useState } from 'react';
import { BarChart3, ExternalLink, ListFilter, Radio } from 'lucide-react';
import { UF_BY_SIGLA } from '@/data/brazil-ufs';
import type { MetricMode, ProjetoLei, UfAggregate } from '@/lib/camara/types';
import { formatDateTimeBr } from '@/lib/timeline-utils';

interface SideTelemetryPanelProps {
  ranking: UfAggregate[];
  maxMetricValue: number;
  metricMode: MetricMode;
  recentProjects: ProjetoLei[];
  selectedUf: string | null;
  onSelectUf: (uf: string) => void;
}

export function SideTelemetryPanel({
  ranking,
  maxMetricValue,
  metricMode,
  recentProjects,
  selectedUf,
  onSelectUf,
}: SideTelemetryPanelProps) {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'FEED'>('RANKING');

  return (
    <aside className="flex h-full min-h-[380px] flex-col rounded-2xl border border-slate-800/80 bg-[#0B1120]/85 backdrop-blur-md">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('RANKING')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'RANKING'
              ? 'bg-slate-800/90 text-cyan-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Ranking por UF
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('FEED')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === 'FEED'
              ? 'bg-slate-800/90 text-cyan-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          Apresentações ({recentProjects.length})
        </button>
      </div>

      {/* Conteúdo */}
      {activeTab === 'RANKING' ? (
        <div className="hud-scroll flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span>27 Unidades Federativas</span>
            <span>
              {metricMode === 'PER_DEPUTY' ? 'Projetos / deputado' : 'PL + PLP'}
            </span>
          </div>
          <div className="space-y-1.5">
            {ranking.map((item, idx) => {
              const meta = UF_BY_SIGLA[item.uf];
              const val =
                metricMode === 'PER_DEPUTY' ? item.perDeputy : item.total;
              const widthPct =
                maxMetricValue > 0 ? Math.max(0, (val / maxMetricValue) * 100) : 0;
              const plRatio = item.total > 0 ? (item.pl / item.total) * 100 : 0;
              const isSelected = selectedUf === item.uf;

              return (
                <button
                  key={item.uf}
                  type="button"
                  onClick={() => onSelectUf(item.uf)}
                  className={`group flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition ${
                    isSelected
                      ? 'border-cyan-400/50 bg-cyan-500/10'
                      : 'border-slate-800/70 bg-slate-900/45 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 font-mono text-[11px] text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-100">
                        {item.uf}
                      </span>
                      <span className="truncate text-slate-300">
                        {meta?.nome ?? item.uf}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="hidden text-[10px] text-slate-400 sm:inline">
                        {item.pl} / {item.plp}
                      </span>
                      <span className="font-bold tabular-nums text-slate-100">
                        {metricMode === 'PER_DEPUTY'
                          ? item.perDeputy.toFixed(2)
                          : item.total.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Barra empilhada PL (ciano) + PLP (âmbar) */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                    {widthPct > 0 && (
                      <div
                        className="flex h-full overflow-hidden rounded-full transition-all duration-200"
                        style={{ width: `${widthPct}%` }}
                      >
                        <div
                          className="h-full bg-cyan-400"
                          style={{ width: `${plRatio}%` }}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${100 - plRatio}%` }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="hud-scroll flex-1 overflow-y-auto p-3">
          {recentProjects.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-xs text-slate-400">
              <ListFilter className="h-5 w-5 text-slate-500" />
              <p>Nenhum projeto apresentado até esta data com o filtro atual.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((proj) => {
                const isPlp = proj.tipo === 'PLP';
                return (
                  <article
                    key={proj.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 transition hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            isPlp
                              ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30'
                              : 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30'
                          }`}
                        >
                          {proj.tipo} {proj.numero}/{proj.ano}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectUf(proj.uf)}
                          className="cursor-pointer rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                        >
                          {proj.uf}
                        </button>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatDateTimeBr(proj.dataApresentacao)}
                      </span>
                    </div>

                    <div className="mt-1.5 text-[11px] font-medium text-slate-200">
                      {proj.autorNome}
                      {proj.autorPartido ? (
                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                          ({proj.autorPartido})
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                      {proj.ementa || 'Sem ementa disponível.'}
                    </p>

                    <div className="mt-2 flex justify-end">
                      <a
                        href={`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proj.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Ficha na Câmara
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
