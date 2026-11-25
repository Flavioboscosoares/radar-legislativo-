'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportedYear } from '@/data/brazil-ufs';
import type {
  LiveFeedResponse,
  MapSignal,
  MetricMode,
  ProjetoLei,
  TipoFilter,
  YearDataset,
} from '@/lib/camara/types';
import { mergeProjects } from '@/lib/camara/transform';
import {
  buildYearCalendar,
  computeSnapshotStats,
  findLastIndexAtOrBeforeDate,
  getBrasiliaDateKey,
  getBrasiliaTimeLabel,
  shiftDateKey,
  type SnapshotStats,
} from '@/lib/timeline-utils';

export const PLAYBACK_SPEEDS = [1, 3, 7, 15, 30] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const SIGNAL_TTL_MS = 1400;
const MAX_ACTIVE_SIGNALS = 45;
const LIVE_POLL_INTERVAL_MS = 60_000;

export interface UseLegislativeTimelineResult {
  year: SupportedYear;
  setYear: (year: SupportedYear) => void;
  dataset: YearDataset | null;
  isLoading: boolean;
  error: string | null;
  retryLoad: () => void;

  calendarDays: string[];
  dayIndex: number;
  currentDateKey: string;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  playFromJan1: () => void;
  resetToJan1: () => void;
  stepDay: (delta: number) => void;
  seekToDayIndex: (index: number) => void;

  tipoFilter: TipoFilter;
  setTipoFilter: (filter: TipoFilter) => void;
  metricMode: MetricMode;
  setMetricMode: (mode: MetricMode) => void;

  stats: SnapshotStats;
  visibleProjectsEndIndex: number;
  recentVisibleProjects: ProjetoLei[];
  activeSignals: MapSignal[];

  isLiveMode: boolean;
  toggleLiveMode: () => void;
  isCheckingLive: boolean;
  lastLiveCheckedAt: string | null;
  liveNewCount: number;
  checkLiveNow: () => Promise<void>;
  replayRecentSignals: () => void;
}

export function useLegislativeTimeline(
  initialYear: SupportedYear = 2026,
): UseLegislativeTimelineResult {
  const [year, setYearState] = useState<SupportedYear>(initialYear);
  const [dataset, setDataset] = useState<YearDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [dayIndex, setDayIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(7);
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('ALL');
  const [metricMode, setMetricMode] = useState<MetricMode>('ABSOLUTE');
  const [activeSignals, setActiveSignals] = useState<MapSignal[]>([]);

  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [isCheckingLive, setIsCheckingLive] = useState<boolean>(false);
  const [lastLiveCheckedAt, setLastLiveCheckedAt] = useState<string | null>(null);
  const [liveNewCount, setLiveNewCount] = useState<number>(0);

  const clientCacheRef = useRef<Map<number, YearDataset>>(new Map());
  const datasetRef = useRef<YearDataset | null>(null);
  datasetRef.current = dataset;

  const calendarDays = useMemo(() => {
    const todayKey = getBrasiliaDateKey();
    const currentYear = Number(todayKey.slice(0, 4));
    const latestDataDate =
      dataset && dataset.projects.length > 0
        ? dataset.projects[dataset.projects.length - 1].dateKey
        : undefined;

    if (year === currentYear) {
      const maxKey =
        latestDataDate && latestDataDate > todayKey ? latestDataDate : todayKey;
      return buildYearCalendar(year, maxKey);
    }
    return buildYearCalendar(year);
  }, [year, dataset]);

  const calendarDaysRef = useRef<string[]>(calendarDays);
  calendarDaysRef.current = calendarDays;

  const dayIndexRef = useRef<number>(dayIndex);
  dayIndexRef.current = dayIndex;

  const speedRef = useRef<PlaybackSpeed>(speed);
  speedRef.current = speed;

  const tipoFilterRef = useRef<TipoFilter>(tipoFilter);
  tipoFilterRef.current = tipoFilter;

  const lastScannedProjectIdxRef = useRef<number>(-1);
  const floatDayRef = useRef<number>(0);
  const replayTimersRef = useRef<number[]>([]);

  const clearReplayTimers = useCallback(() => {
    for (const t of replayTimersRef.current) {
      window.clearTimeout(t);
    }
    replayTimersRef.current = [];
  }, []);

  const pushSignals = useCallback((incoming: MapSignal[]) => {
    if (incoming.length === 0) return;
    const now = Date.now();
    setActiveSignals((prev) => {
      const alive = prev.filter((s) => now - s.createdAt < SIGNAL_TTL_MS);
      return [...alive, ...incoming].slice(-MAX_ACTIVE_SIGNALS);
    });
  }, []);

  // Limpeza automática de sinais expirados
  useEffect(() => {
    if (activeSignals.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setActiveSignals((prev) => {
        const next = prev.filter((s) => now - s.createdAt < SIGNAL_TTL_MS);
        return next.length === prev.length ? prev : next;
      });
    }, 220);
    return () => window.clearInterval(timer);
  }, [activeSignals.length]);

  useEffect(() => {
    return () => clearReplayTimers();
  }, [clearReplayTimers]);

  // Carrega dataset do ano selecionado
  useEffect(() => {
    let cancelled = false;
    clearReplayTimers();
    setActiveSignals([]);
    setError(null);

    const cached = clientCacheRef.current.get(year);
    if (cached && reloadNonce === 0) {
      setDataset(cached);
      setIsLoading(false);
      const todayKey = getBrasiliaDateKey();
      const currentYr = Number(todayKey.slice(0, 4));
      const latestData =
        cached.projects.length > 0
          ? cached.projects[cached.projects.length - 1].dateKey
          : undefined;
      const maxKey =
        year === currentYr
          ? latestData && latestData > todayKey
            ? latestData
            : todayKey
          : undefined;
      const days = buildYearCalendar(year, maxKey);
      const endIdx = Math.max(0, days.length - 1);
      setDayIndex(endIdx);
      floatDayRef.current = endIdx;
      lastScannedProjectIdxRef.current = findLastIndexAtOrBeforeDate(
        cached.projects,
        days[endIdx] ?? `${year}-12-31`,
      );
      return;
    }

    setIsLoading(true);
    fetch(`/api/proposicoes?year=${year}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Erro HTTP ${res.status}`);
        }
        return (await res.json()) as YearDataset;
      })
      .then((data) => {
        if (cancelled) return;
        clientCacheRef.current.set(year, data);
        setDataset(data);
        setIsLoading(false);

        const todayKey = getBrasiliaDateKey();
        const currentYr = Number(todayKey.slice(0, 4));
        const latestData =
          data.projects.length > 0
            ? data.projects[data.projects.length - 1].dateKey
            : undefined;
        const maxKey =
          year === currentYr
            ? latestData && latestData > todayKey
              ? latestData
              : todayKey
            : undefined;
        const days = buildYearCalendar(year, maxKey);
        const endIdx = Math.max(0, days.length - 1);
        setDayIndex(endIdx);
        floatDayRef.current = endIdx;
        lastScannedProjectIdxRef.current = findLastIndexAtOrBeforeDate(
          data.projects,
          days[endIdx] ?? `${year}-12-31`,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar dados da Câmara.',
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, reloadNonce, clearReplayTimers]);

  const emitSignalsForRange = useCallback(
    (fromProjectIdxExclusive: number, toProjectIdxInclusive: number) => {
      const ds = datasetRef.current;
      if (!ds || toProjectIdxInclusive <= fromProjectIdxExclusive) return;

      const filter = tipoFilterRef.current;
      const now = Date.now();
      const matched: ProjetoLei[] = [];

      for (let i = fromProjectIdxExclusive + 1; i <= toProjectIdxInclusive; i++) {
        const p = ds.projects[i];
        if (!p) continue;
        if (filter !== 'ALL' && p.tipo !== filter) continue;
        matched.push(p);
      }

      if (matched.length === 0) return;

      // Em velocidades altas ou lotes grandes num único frame, agrupa por UF+tipo para manter clareza visual e 60fps
      if (matched.length > 6 || speedRef.current >= 15) {
        const grouped = new Map<string, { last: ProjetoLei; count: number }>();
        for (const p of matched) {
          const key = `${p.uf}:${p.tipo}`;
          const prev = grouped.get(key);
          if (prev) {
            prev.last = p;
            prev.count++;
          } else {
            grouped.set(key, { last: p, count: 1 });
          }
        }
        const signals: MapSignal[] = Array.from(grouped.values()).map(
          ({ last, count }, idx) => ({
            uid: `${last.id}-${now}-${idx}`,
            uf: last.uf,
            tipo: last.tipo,
            label:
              count > 1
                ? `${last.uf} +${count}`
                : `${last.tipo} ${last.numero} • ${last.uf}`,
            burstCount: count,
            createdAt: now,
            projectId: last.id,
          }),
        );
        pushSignals(signals);
        return;
      }

      const signals: MapSignal[] = matched.map((p, idx) => ({
        uid: `${p.id}-${now}-${idx}`,
        uf: p.uf,
        tipo: p.tipo,
        label: `${p.tipo} ${p.numero} • ${p.uf}`,
        burstCount: 1,
        createdAt: now,
        projectId: p.id,
      }));
      pushSignals(signals);
    },
    [pushSignals],
  );

  // Loop de reprodução 60fps via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !dataset) return;

    let rafId = 0;
    let lastTime = performance.now();
    floatDayRef.current = dayIndexRef.current;

    const tick = (now: number) => {
      const dtSec = Math.min((now - lastTime) / 1000, 0.12);
      lastTime = now;

      const days = calendarDaysRef.current;
      const maxDayIdx = Math.max(0, days.length - 1);
      floatDayRef.current = Math.min(
        maxDayIdx,
        floatDayRef.current + dtSec * speedRef.current,
      );

      const nextDayIdx = Math.floor(floatDayRef.current);
      if (nextDayIdx !== dayIndexRef.current) {
        const targetDateKey = days[nextDayIdx];
        const ds = datasetRef.current;
        if (ds && targetDateKey) {
          const newProjIdx = findLastIndexAtOrBeforeDate(ds.projects, targetDateKey);
          emitSignalsForRange(lastScannedProjectIdxRef.current, newProjIdx);
          lastScannedProjectIdxRef.current = newProjIdx;
        }
        setDayIndex(nextDayIdx);
      }

      if (floatDayRef.current >= maxDayIdx) {
        const targetDateKey = days[maxDayIdx];
        const ds = datasetRef.current;
        if (ds && targetDateKey) {
          const newProjIdx = findLastIndexAtOrBeforeDate(ds.projects, targetDateKey);
          emitSignalsForRange(lastScannedProjectIdxRef.current, newProjIdx);
          lastScannedProjectIdxRef.current = newProjIdx;
        }
        setDayIndex(maxDayIdx);
        setIsPlaying(false);
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, dataset, emitSignalsForRange]);

  const setYear = useCallback(
    (nextYear: SupportedYear) => {
      setIsPlaying(false);
      if (nextYear !== 2026) {
        setIsLiveMode(false);
      }
      setYearState(nextYear);
    },
    [],
  );

  const seekToDayIndex = useCallback((rawIndex: number) => {
    const days = calendarDaysRef.current;
    const clamped = Math.max(0, Math.min(rawIndex, Math.max(0, days.length - 1)));
    const ds = datasetRef.current;
    const prevProjIdx = lastScannedProjectIdxRef.current;

    floatDayRef.current = clamped;
    setDayIndex(clamped);

    if (ds && days[clamped]) {
      const nextProjIdx = findLastIndexAtOrBeforeDate(ds.projects, days[clamped]);
      // Em saltos curtos para frente (ex: +1 dia), dispara os sinais do dia
      if (clamped > dayIndexRef.current && clamped - dayIndexRef.current <= 3) {
        emitSignalsForRange(prevProjIdx, nextProjIdx);
      }
      lastScannedProjectIdxRef.current = nextProjIdx;
    }
  }, [emitSignalsForRange]);

  const resetToJan1 = useCallback(() => {
    clearReplayTimers();
    setIsLiveMode(false);
    setIsPlaying(false);
    setActiveSignals([]);
    floatDayRef.current = 0;
    setDayIndex(0);
    const ds = datasetRef.current;
    if (ds) {
      lastScannedProjectIdxRef.current = findLastIndexAtOrBeforeDate(
        ds.projects,
        calendarDaysRef.current[0] ?? `${year}-01-01`,
      );
    } else {
      lastScannedProjectIdxRef.current = -1;
    }
  }, [clearReplayTimers, year]);

  const playFromJan1 = useCallback(() => {
    clearReplayTimers();
    setIsLiveMode(false);
    setActiveSignals([]);
    floatDayRef.current = 0;
    setDayIndex(0);
    lastScannedProjectIdxRef.current = -1;
    // Garante disparo imediato se houver projetos em 01/01
    const ds = datasetRef.current;
    const jan1Key = calendarDaysRef.current[0];
    if (ds && jan1Key) {
      const idx = findLastIndexAtOrBeforeDate(ds.projects, jan1Key);
      emitSignalsForRange(-1, idx);
      lastScannedProjectIdxRef.current = idx;
    }
    setIsPlaying(true);
  }, [clearReplayTimers, emitSignalsForRange]);

  const play = useCallback(() => {
    if (!datasetRef.current) return;
    setIsLiveMode(false);
    const maxDayIdx = Math.max(0, calendarDaysRef.current.length - 1);
    if (dayIndexRef.current >= maxDayIdx) {
      playFromJan1();
      return;
    }
    setIsPlaying(true);
  }, [playFromJan1]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stepDay = useCallback(
    (delta: number) => {
      setIsPlaying(false);
      setIsLiveMode(false);
      seekToDayIndex(dayIndexRef.current + delta);
    },
    [seekToDayIndex],
  );

  // Polling do Modo Ao Vivo
  const checkLiveNow = useCallback(async () => {
    setIsCheckingLive(true);
    try {
      const todayKey = getBrasiliaDateKey();
      const since = shiftDateKey(todayKey, -2);
      const res = await fetch(`/api/proposicoes/live?since=${since}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as LiveFeedResponse;
      setLastLiveCheckedAt(getBrasiliaTimeLabel(new Date(body.checkedAt)));

      const currentDs = datasetRef.current;
      if (!currentDs || currentDs.year !== Number(todayKey.slice(0, 4))) return;

      const existingIds = new Set(currentDs.projects.map((p) => p.id));
      const brandNew = body.projects.filter((p) => !existingIds.has(p.id));

      if (brandNew.length > 0) {
        const merged = mergeProjects(
          currentDs.projects,
          brandNew,
          currentDs.year,
        );
        const updatedDs: YearDataset = {
          ...currentDs,
          ...merged,
        };
        clientCacheRef.current.set(currentDs.year, updatedDs);
        setDataset(updatedDs);
        setLiveNewCount((c) => c + brandNew.length);

        const now = Date.now();
        pushSignals(
          brandNew.map((p, idx) => ({
            uid: `live-${p.id}-${now}-${idx}`,
            uf: p.uf,
            tipo: p.tipo,
            label: `AO VIVO • ${p.tipo} ${p.numero} • ${p.uf}`,
            burstCount: 1,
            createdAt: now,
            projectId: p.id,
          })),
        );
      }
    } catch {
      // Silencioso no polling automático; próxima tentativa ocorre no intervalo
    } finally {
      setIsCheckingLive(false);
    }
  }, [pushSignals]);

  const replayRecentSignals = useCallback(() => {
    const ds = datasetRef.current;
    if (!ds || ds.projects.length === 0) return;

    clearReplayTimers();
    const filter = tipoFilterRef.current;
    const filtered = ds.projects.filter(
      (p) => filter === 'ALL' || p.tipo === filter,
    );
    const sample = filtered.slice(-10);

    sample.forEach((proj, idx) => {
      const timer = window.setTimeout(() => {
        pushSignals([
          {
            uid: `replay-${proj.id}-${Date.now()}`,
            uf: proj.uf,
            tipo: proj.tipo,
            label: `${proj.tipo} ${proj.numero} • ${proj.uf}`,
            burstCount: 1,
            createdAt: Date.now(),
            projectId: proj.id,
          },
        ]);
      }, idx * 380);
      replayTimersRef.current.push(timer);
    });
  }, [clearReplayTimers, pushSignals]);

  const toggleLiveMode = useCallback(() => {
    setIsLiveMode((prev) => {
      const next = !prev;
      if (next) {
        setIsPlaying(false);
        const currentYear = Number(getBrasiliaDateKey().slice(0, 4)) as SupportedYear;
        if (year !== currentYear) {
          setYearState(currentYear);
        } else {
          const days = calendarDaysRef.current;
          const endIdx = Math.max(0, days.length - 1);
          floatDayRef.current = endIdx;
          setDayIndex(endIdx);
          if (datasetRef.current) {
            lastScannedProjectIdxRef.current = datasetRef.current.projects.length - 1;
          }
        }
      } else {
        clearReplayTimers();
      }
      return next;
    });
  }, [clearReplayTimers, year]);

  useEffect(() => {
    if (!isLiveMode || !dataset) return;
    const currentYear = Number(getBrasiliaDateKey().slice(0, 4));
    if (dataset.year !== currentYear) return;

    const endIdx = Math.max(0, calendarDays.length - 1);
    setDayIndex(endIdx);
    floatDayRef.current = endIdx;
    lastScannedProjectIdxRef.current = dataset.projects.length - 1;

    void checkLiveNow();
    const interval = window.setInterval(() => {
      void checkLiveNow();
    }, LIVE_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isLiveMode, dataset?.year, calendarDays.length, checkLiveNow]);

  // Atalhos de teclado (Espaço = Play/Pause, Setas = -1/+1 dia, R = 01/Jan)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepDay(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepDay(1);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetToJan1();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, stepDay, resetToJan1]);

  const currentDateKey =
    calendarDays[dayIndex] ?? `${year}-01-01`;

  const visibleProjectsEndIndex = useMemo(() => {
    if (!dataset) return -1;
    return findLastIndexAtOrBeforeDate(dataset.projects, currentDateKey);
  }, [dataset, currentDateKey]);

  const stats = useMemo(() => {
    return computeSnapshotStats(
      dataset?.projects ?? [],
      visibleProjectsEndIndex,
      tipoFilter,
      metricMode,
    );
  }, [dataset, visibleProjectsEndIndex, tipoFilter, metricMode]);

  const recentVisibleProjects = useMemo(() => {
    if (!dataset || visibleProjectsEndIndex < 0) return [];
    const out: ProjetoLei[] = [];
    for (let i = visibleProjectsEndIndex; i >= 0 && out.length < 60; i--) {
      const p = dataset.projects[i];
      if (tipoFilter !== 'ALL' && p.tipo !== tipoFilter) continue;
      out.push(p);
    }
    return out;
  }, [dataset, visibleProjectsEndIndex, tipoFilter]);

  const retryLoad = useCallback(() => {
    clientCacheRef.current.delete(year);
    setReloadNonce((n) => n + 1);
  }, [year]);

  return {
    year,
    setYear,
    dataset,
    isLoading,
    error,
    retryLoad,
    calendarDays,
    dayIndex,
    currentDateKey,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    togglePlay,
    playFromJan1,
    resetToJan1,
    stepDay,
    seekToDayIndex,
    tipoFilter,
    setTipoFilter,
    metricMode,
    setMetricMode,
    stats,
    visibleProjectsEndIndex,
    recentVisibleProjects,
    activeSignals,
    isLiveMode,
    toggleLiveMode,
    isCheckingLive,
    lastLiveCheckedAt,
    liveNewCount,
    checkLiveNow,
    replayRecentSignals,
  };
}
