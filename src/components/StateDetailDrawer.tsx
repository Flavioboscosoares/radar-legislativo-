'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search, User, X } from 'lucide-react';
import { UF_BY_SIGLA } from '@/data/brazil-ufs';
import type { ProjetoLei, TipoFilter, UfAggregate } from '@/lib/camara/types';
import { formatDateHud, formatDateTimeBr } from '@/lib/timeline-utils';

interface StateDetailDrawerProps {
  uf: string | null;
  onClose: () => void;
  projects: readonly ProjetoLei[];
  visibleEndIndex: number;
  tipoFilter: TipoFilter;
  currentDateKey: string;
  aggregate: UfAggregate | undefined;
}

export function StateDetailDrawer({
  uf,
  onClose,
  projects,
  visibleEndIndex,
  tipoFilter,
  currentDateKey,
  aggregate,
}: StateDetailDrawerProps) {
  const [query, setQuery] = useState('');

  const { stateProjects, topAuthors, topParties } = useMemo(() => {
    if (!uf || visibleEndIndex < 0) {
      return { stateProjects: [], topAuthors: [], topParties: [] };
    }

    const list: ProjetoLei[] = [];
    const authorMap = new Map<string, { nome: string; partido: string; count: number }>();
    const partyMap = new Map<string, number>();

    for (let i = visibleEndIndex; i >= 0; i--) {
      const p = projects[i];
      if (p.uf !== uf) continue;
      if (tipoFilter !== 'ALL' && p.tipo !== tipoFilter) continue;

      list.push(p);

      const authKey = p.autorNome;
      const prevAuth = authorMap.get(authKey);
      if (prevAuth) {
        prevAuth.count++;
      } else {
        authorMap.set(authKey, {
          nome: p.autorNome,
          partido: p.autorPartido,
          count: 1,
        });
      }

      if (p.autorPartido) {
        partyMap.set(p.autorPartido, (partyMap.get(p.autorPartido) ?? 0) + 1);
      }
    }

    const topAuthors = Array.from(authorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topParties = Array.from(partyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { stateProjects: list, topAuthors, topParties };
  }, [uf, projects, visibleEndIndex, tipoFilter]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stateProjects.slice(0, 100);
    return stateProjects
      .filter(
        (p) =>
          p.ementa.toLowerCase().includes(q) ||
          p.autorNome.toLowerCase().includes(q) ||
          `${p.tipo} ${p.numero}`.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [stateProjects, query]);

  if (!uf) return null;

  const meta = UF_BY_SIGLA[uf];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#090F1D] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300 ring-1 ring-cyan-400/30">
                {uf}
              </span>
              <h2 className="font-[var(--font-display)] text-lg font-bold text-slate-50">
                {meta?.nome ?? uf}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Região {meta?.regiao} • Bancada de {meta?.cadeiras ?? 0} deputados •
              Acumulado até {formatDateHud(currentDateKey)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do estado"
            className="cursor-pointer rounded-lg border border-slate-800 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Métricas da UF */}
        <div className="grid grid-cols-4 gap-2 border-b border-slate-800/80 px-5 py-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="text-[10px] uppercase text-slate-400">Total</div>
            <div className="font-mono text-base font-bold text-slate-100">
              {(aggregate?.total ?? 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2">
            <div className="text-[10px] uppercase text-cyan-400">PL</div>
            <div className="font-mono text-base font-bold text-cyan-300">
              {(aggregate?.pl ?? 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2">
            <div className="text-[10px] uppercase text-amber-400">PLP</div>
            <div className="font-mono text-base font-bold text-amber-300">
              {(aggregate?.plp ?? 0).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="text-[10px] uppercase text-slate-400">Por Dep.</div>
            <div className="font-mono text-base font-bold text-slate-100">
              {(aggregate?.perDeputy ?? 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Top Autores e Partidos */}
        {topAuthors.length > 0 && (
          <div className="border-b border-slate-800/80 px-5 py-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Principais Propositores ({uf})
            </div>
            <div className="space-y-1">
              {topAuthors.map((auth) => (
                <div
                  key={auth.nome}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 truncate text-slate-200">
                    <User className="h-3 w-3 shrink-0 text-slate-500" />
                    <span className="truncate">{auth.nome}</span>
                    {auth.partido ? (
                      <span className="font-mono text-[10px] text-slate-400">
                        ({auth.partido})
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono font-semibold text-cyan-300">
                    {auth.count}
                  </span>
                </div>
              ))}
            </div>

            {topParties.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {topParties.map(([party, count]) => (
                  <span
                    key={party}
                    className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                  >
                    {party}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Busca */}
        <div className="border-b border-slate-800/80 px-5 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, autor ou ementa..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Lista de projetos */}
        <div className="hud-scroll flex-1 overflow-y-auto px-5 py-3">
          {filteredProjects.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              Nenhum projeto encontrado para este estado até a data selecionada.
            </p>
          ) : (
            <div className="space-y-2.5">
              {filteredProjects.map((proj) => {
                const isPlp = proj.tipo === 'PLP';
                return (
                  <article
                    key={proj.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          isPlp
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {proj.tipo} {proj.numero}/{proj.ano}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatDateTimeBr(proj.dataApresentacao)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-slate-200">
                      {proj.autorNome}{' '}
                      {proj.autorPartido ? (
                        <span className="font-mono text-[11px] text-slate-400">
                          ({proj.autorPartido})
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {proj.ementa || 'Sem ementa disponível.'}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <a
                        href={`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proj.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Ver tramitação oficial
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
              {stateProjects.length > 100 && !query && (
                <p className="py-2 text-center font-mono text-[11px] text-slate-500">
                  Exibindo os 100 projetos mais recentes de {stateProjects.length}. Use a busca acima para filtrar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
