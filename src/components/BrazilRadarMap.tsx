'use client';

import { useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import brUfsGeoJson from '@/data/br-ufs.json';
import { UF_BY_IBGE_CODE, type BrazilUfMeta } from '@/data/brazil-ufs';
import type { MapSignal, MetricMode, TipoFilter, UfAggregate } from '@/lib/camara/types';

interface IbgeProperties {
  codarea: string;
}

interface ProjectedState {
  meta: BrazilUfMeta;
  pathD: string;
  centroid: [number, number];
  labelPos: [number, number];
}

interface BrazilRadarMapProps {
  byUf: Record<string, UfAggregate>;
  maxMetricValue: number;
  totalNational: number;
  tipoFilter: TipoFilter;
  metricMode: MetricMode;
  activeSignals: MapSignal[];
  selectedUf: string | null;
  onSelectUf: (uf: string) => void;
  showCallouts: boolean;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 760;

function getChoroplethFill(
  value: number,
  maxValue: number,
  tipoFilter: TipoFilter,
): string {
  if (value <= 0 || maxValue <= 0) {
    return '#0F172A';
  }
  const ratio = Math.min(1, Math.sqrt(value / maxValue));

  if (tipoFilter === 'PLP') {
    if (ratio < 0.22) return '#3B230A';
    if (ratio < 0.45) return '#6B3B0B';
    if (ratio < 0.68) return '#A15807';
    if (ratio < 0.86) return '#D97706';
    return '#F59E0B';
  }

  // Escala ciano/azul radar para PL ou Todos
  if (ratio < 0.22) return '#0D253F';
  if (ratio < 0.45) return '#0E4166';
  if (ratio < 0.68) return '#0E688E';
  if (ratio < 0.86) return '#0891B2';
  return '#22D3EE';
}

export function BrazilRadarMap({
  byUf,
  maxMetricValue,
  totalNational,
  tipoFilter,
  metricMode,
  activeSignals,
  selectedUf,
  onSelectUf,
  showCallouts,
}: BrazilRadarMapProps) {
  const [hoveredUf, setHoveredUf] = useState<{
    uf: string;
    x: number;
    y: number;
  } | null>(null);

  const projectedStates = useMemo(() => {
    const fc = brUfsGeoJson as unknown as FeatureCollection<Geometry, IbgeProperties>;
    const projection = geoMercator().fitExtent(
      [
        [36, 26],
        [SVG_WIDTH - 48, SVG_HEIGHT - 30],
      ],
      fc,
    );
    const pathGen = geoPath(projection);

    const list: ProjectedState[] = [];
    for (const feature of fc.features) {
      const codarea = String(feature.properties?.codarea ?? '');
      const meta = UF_BY_IBGE_CODE[codarea];
      if (!meta) continue;
      const pathD = pathGen(feature) ?? '';
      const rawCentroid = pathGen.centroid(feature);
      const cx = Number.isFinite(rawCentroid[0]) ? rawCentroid[0] : 400;
      const cy = Number.isFinite(rawCentroid[1]) ? rawCentroid[1] : 380;
      const offset = meta.labelOffset ?? [0, 0];
      list.push({
        meta,
        pathD,
        centroid: [cx, cy],
        labelPos: [cx + offset[0], cy + offset[1]],
      });
    }
    return list;
  }, []);

  const stateCoordsBySigla = useMemo(() => {
    const map: Record<string, ProjectedState> = {};
    for (const st of projectedStates) {
      map[st.meta.sigla] = st;
    }
    return map;
  }, [projectedStates]);

  // Estado com sinal recente ativo
  const pulsingUfs = useMemo(() => {
    const map = new Map<string, 'PL' | 'PLP'>();
    for (const sig of activeSignals) {
      map.set(sig.uf, sig.tipo);
    }
    return map;
  }, [activeSignals]);

  // Apenas os últimos 5 callouts simultâneos para não poluir
  const visibleCallouts = useMemo(() => {
    if (!showCallouts) return [];
    return activeSignals.slice(-5);
  }, [activeSignals, showCallouts]);

  const hoveredAggregate = hoveredUf ? byUf[hoveredUf.uf] : null;
  const hoveredMeta = hoveredUf ? stateCoordsBySigla[hoveredUf.uf]?.meta : null;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Anéis sutis de radar ao fundo */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="h-full max-h-[680px] w-full select-none"
        role="img"
        aria-label="Mapa do Brasil com distribuição de Projetos de Lei por estado"
      >
        <defs>
          <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grade polar de radar decorativa */}
        <g className="pointer-events-none opacity-25">
          <circle
            cx={410}
            cy={375}
            r={130}
            fill="none"
            stroke="#1E293B"
            strokeDasharray="4 6"
          />
          <circle
            cx={410}
            cy={375}
            r={245}
            fill="none"
            stroke="#1E293B"
            strokeDasharray="4 6"
          />
          <circle
            cx={410}
            cy={375}
            r={355}
            fill="none"
            stroke="#1E293B"
            strokeDasharray="4 6"
          />
          <line x1={40} y1={375} x2={760} y2={375} stroke="#1E293B" strokeDasharray="2 6" />
          <line x1={410} y1={25} x2={410} y2={730} stroke="#1E293B" strokeDasharray="2 6" />
        </g>

        {/* Camada 1: Estados */}
        <g>
          {projectedStates.map((st) => {
            const agg = byUf[st.meta.sigla];
            const metricVal = agg
              ? metricMode === 'PER_DEPUTY'
                ? agg.perDeputy
                : agg.total
              : 0;
            const fill = getChoroplethFill(metricVal, maxMetricValue, tipoFilter);
            const isSelected = selectedUf === st.meta.sigla;
            const isHovered = hoveredUf?.uf === st.meta.sigla;
            const activePulseTipo = pulsingUfs.get(st.meta.sigla);

            let strokeColor = '#334155';
            let strokeWidth = 0.9;
            if (isSelected) {
              strokeColor = '#F8FAFC';
              strokeWidth = 2.2;
            } else if (isHovered) {
              strokeColor = '#94A3B8';
              strokeWidth = 1.8;
            } else if (activePulseTipo === 'PLP') {
              strokeColor = '#FCD34D';
              strokeWidth = 1.9;
            } else if (activePulseTipo === 'PL') {
              strokeColor = '#67E8F9';
              strokeWidth = 1.9;
            }

            return (
              <path
                key={st.meta.sigla}
                d={st.pathD}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                className={`cursor-pointer transition-colors duration-200 ${
                  activePulseTipo ? 'animate-state-flash' : ''
                }`}
                onClick={() => onSelectUf(st.meta.sigla)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!rect) return;
                  setHoveredUf({
                    uf: st.meta.sigla,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!rect) return;
                  setHoveredUf({
                    uf: st.meta.sigla,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredUf(null)}
              />
            );
          })}
        </g>

        {/* Camada 2: Siglas das UFs */}
        <g className="pointer-events-none">
          {projectedStates.map((st) => {
            const agg = byUf[st.meta.sigla];
            const hasActivity = (agg?.total ?? 0) > 0;
            const hasOffset = Boolean(st.meta.labelOffset);
            return (
              <g key={`lbl-${st.meta.sigla}`}>
                {hasOffset && (
                  <line
                    x1={st.centroid[0]}
                    y1={st.centroid[1]}
                    x2={st.labelPos[0]}
                    y2={st.labelPos[1]}
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeWidth={0.75}
                  />
                )}
                <text
                  x={st.labelPos[0]}
                  y={st.labelPos[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-[10px] font-semibold"
                  fill={hasActivity ? '#F8FAFC' : '#64748B'}
                  style={{
                    textShadow: '0 1px 3px rgba(2, 6, 23, 0.95)',
                  }}
                >
                  {st.meta.sigla}
                </text>
              </g>
            );
          })}
        </g>

        {/* Camada 3: Sinalizações de Apresentação (Ondas de Radar) */}
        <g className="pointer-events-none">
          {activeSignals.map((sig) => {
            const st = stateCoordsBySigla[sig.uf];
            if (!st) return null;
            const [cx, cy] = st.centroid;
            const isPlp = sig.tipo === 'PLP';
            const color = isPlp ? '#F59E0B' : '#22D3EE';
            const innerColor = isPlp ? '#FDE68A' : '#A5F3FC';
            const baseR = sig.burstCount > 1 ? 11 : 8;

            return (
              <g key={sig.uid}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.2}
                  filter={isPlp ? 'url(#glow-amber)' : 'url(#glow-cyan)'}
                  className="animate-radar-ping"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2}
                  className="animate-radar-ping-outer"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={sig.burstCount > 1 ? 4.5 : 3.2}
                  fill={innerColor}
                  filter={isPlp ? 'url(#glow-amber)' : 'url(#glow-cyan)'}
                />
              </g>
            );
          })}
        </g>

        {/* Camada 4: Callouts Flutuantes (velocidades baixas ou Ao Vivo) */}
        <g className="pointer-events-none">
          {visibleCallouts.map((sig, idx) => {
            const st = stateCoordsBySigla[sig.uf];
            if (!st) return null;
            const [cx, cy] = st.centroid;
            const isPlp = sig.tipo === 'PLP';
            const yShift = -18 - (idx % 2) * 18;
            return (
              <g
                key={`callout-${sig.uid}`}
                transform={`translate(${cx}, ${cy + yShift})`}
              >
                <g className="animate-callout-float">
                  <rect
                    x={-54}
                    y={-12}
                    width={108}
                    height={20}
                    rx={6}
                    fill="rgba(6, 10, 19, 0.9)"
                    stroke={isPlp ? 'rgba(245, 158, 11, 0.7)' : 'rgba(34, 211, 238, 0.7)'}
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={-1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-mono text-[9.5px] font-semibold"
                    fill={isPlp ? '#FDE68A' : '#A5F3FC'}
                  >
                    {sig.label}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legenda no canto inferior esquerdo do mapa */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-[#080E1B]/85 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            Sinal PL
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
            Sinal PLP
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-400">0</span>
          <div className="flex h-2 w-28 overflow-hidden rounded-full border border-slate-700/60">
            {(tipoFilter === 'PLP'
              ? ['#0F172A', '#3B230A', '#6B3B0B', '#A15807', '#D97706', '#F59E0B']
              : ['#0F172A', '#0D253F', '#0E4166', '#0E688E', '#0891B2', '#22D3EE']
            ).map((hex) => (
              <span key={hex} className="h-full flex-1" style={{ backgroundColor: hex }} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-slate-300">
            {metricMode === 'PER_DEPUTY'
              ? `${maxMetricValue.toFixed(1)}/dep`
              : maxMetricValue.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Tooltip flutuante */}
      {hoveredUf && hoveredAggregate && hoveredMeta && (
        <div
          className="pointer-events-none absolute z-30 w-56 rounded-xl border border-slate-700/90 bg-[#0A1120]/95 p-3 shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(hoveredUf.x + 16, 460),
            top: Math.max(hoveredUf.y - 12, 12),
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div>
              <span className="font-[var(--font-display)] text-sm font-bold text-slate-100">
                {hoveredMeta.nome}
              </span>
              <span className="ml-1.5 font-mono text-xs text-slate-400">
                ({hoveredMeta.sigla})
              </span>
            </div>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {hoveredMeta.cadeiras} dep.
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs">
            <div className="text-slate-400">Total:</div>
            <div className="text-right font-bold text-slate-100">
              {hoveredAggregate.total.toLocaleString('pt-BR')}
            </div>

            <div className="text-cyan-400/90">PL:</div>
            <div className="text-right text-cyan-300">
              {hoveredAggregate.pl.toLocaleString('pt-BR')}
            </div>

            <div className="text-amber-400/90">PLP:</div>
            <div className="text-right text-amber-300">
              {hoveredAggregate.plp.toLocaleString('pt-BR')}
            </div>

            <div className="text-slate-400">Por dep.:</div>
            <div className="text-right text-slate-200">
              {hoveredAggregate.perDeputy.toFixed(2)}
            </div>

            <div className="text-slate-400">Brasil:</div>
            <div className="text-right text-slate-200">
              {totalNational > 0
                ? `${((hoveredAggregate.total / totalNational) * 100).toFixed(1)}%`
                : '0.0%'}
            </div>
          </div>

          <div className="mt-2 text-[10px] text-slate-400">
            Clique no estado para ver projetos e autores
          </div>
        </div>
      )}
    </div>
  );
}
