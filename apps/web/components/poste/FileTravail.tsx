'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CLASSE_RISQUE_LABELS } from '@imf/shared';
import { money, useFile, type LigneFile } from '../../lib/poste';
import s from './poste.module.css';

export function ScoreBadge({ score }: { score: LigneFile['score'] }) {
  if (!score) return null;
  return (
    <span
      className={`${s.scoreBadge} ${s[`classe${score.classe}`]}`}
      title={`Score ${score.total}/100 — ${CLASSE_RISQUE_LABELS[score.classe]}`}
    >
      {score.classe}
    </span>
  );
}

function AvisChip({ statut }: { statut: LigneFile['avisIa'] }) {
  if (statut === 'PRET') return <span className={`${s.chip} ${s.chipBlue}`}>✦ Avis IA prêt</span>;
  if (statut === 'EN_ATTENTE' || statut === 'EN_COURS') return <span className={s.chip}>✦ IA en préparation…</span>;
  if (statut === 'ECHEC') return <span className={`${s.chip} ${s.chipAmber}`}>✦ IA à relancer</span>;
  return null;
}

function correspond(d: LigneFile, q: string) {
  if (!q) return true;
  const t = q.toLowerCase();
  return [d.reference, d.client.fullName, d.produitLabel, d.client.commune?.name, d.agent?.displayName]
    .filter(Boolean)
    .some((x) => String(x).toLowerCase().includes(t));
}

export function FileTravail({ base, titre }: { base: string; titre: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, isLoading } = useFile();
  const [onglet, setOnglet] = useState<string | null>(params.get('onglet'));
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const ongletActif = onglet ?? data?.onglets.find((o) => o.aTraiter && o.count > 0)?.key ?? data?.onglets[0]?.key ?? null;
  const lignes = useMemo(
    () => (data?.dossiers ?? []).filter((d) => d.onglet === ongletActif && correspond(d, q)),
    [data, ongletActif, q],
  );

  useEffect(() => setFocus(0), [ongletActif, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      const saisie = cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName);
      if (e.key === '/' && !saisie) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (saisie) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus((f) => Math.min(lignes.length - 1, f + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus((f) => Math.max(0, f - 1));
      } else if (e.key === 'Enter' && lignes[focus]) {
        router.push(`/${base}/${lignes[focus].id}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lignes, focus, base, router]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${focus}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  const choisir = (key: string) => {
    setOnglet(key);
    const url = new URL(window.location.href);
    url.searchParams.set('onglet', key);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>{titre}</h1>
          <p className={s.pageSub}>
            {data ? `${data.aTraiter} dossier(s) à traiter` : 'Chargement…'} · classés par priorité (retours, retards,
            ancienneté)
          </p>
        </div>
        <p className={s.hint}>
          <span className={s.kbd}>/</span> rechercher · <span className={s.kbd}>j</span>{' '}
          <span className={s.kbd}>k</span> naviguer · <span className={s.kbd}>Entrée</span> ouvrir ·{' '}
          <span className={s.kbd}>Ctrl K</span> palette
        </p>
      </div>

      <div className={s.tabs} role="tablist">
        {(data?.onglets ?? []).map((o) => (
          <button
            key={o.key}
            role="tab"
            aria-selected={o.key === ongletActif}
            type="button"
            className={`${s.tab} ${o.key === ongletActif ? s.tabActive : ''}`}
            onClick={() => choisir(o.key)}
          >
            {o.label}
            <span className={`${s.count} ${o.aTraiter && o.count > 0 ? s.countHot : ''}`}>{o.count}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <input
          ref={searchRef}
          className={s.search}
          placeholder="Référence, client, produit, commune, agent…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher dans la file"
        />
      </div>

      {error ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>Impossible de charger la file</p>
          <p>{error instanceof Error ? error.message : 'Erreur'}</p>
        </div>
      ) : isLoading && !data ? (
        <div className={s.list}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={s.row} style={{ cursor: 'default' }}>
              <span />
              <div className={s.skeleton} style={{ height: 34 }} />
              <div className={s.skeleton} style={{ height: 18 }} />
              <div className={s.skeleton} style={{ height: 18 }} />
              <div className={s.skeleton} style={{ height: 18 }} />
              <div className={s.skeleton} style={{ height: 18 }} />
            </div>
          ))}
        </div>
      ) : lignes.length === 0 ? (
        <div className={`${s.list} ${s.empty}`}>
          <p className={s.emptyTitle}>{q ? 'Aucun dossier ne correspond à la recherche' : 'Rien à traiter dans cet onglet'}</p>
          <p>
            {(data?.onglets ?? [])
              .filter((o) => o.key !== ongletActif && o.count > 0)
              .map((o) => `${o.count} « ${o.label} »`)
              .join(' · ') || 'La file est vide.'}
          </p>
        </div>
      ) : (
        <div className={s.list} ref={listRef} role="list">
          {lignes.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="listitem"
              data-index={i}
              className={`${s.row} ${i === focus ? s.rowFocus : ''}`}
              onClick={() => router.push(`/${base}/${d.id}`)}
              onMouseEnter={() => setFocus(i)}
            >
              <span className={`${s.rowBar} ${d.enRetard || d.retours ? s.rowBarHot : d.aTraiter ? s.rowBarTodo : ''}`} />
              <div className={s.rowMain}>
                <p className={s.rowTitle}>{d.client.fullName}</p>
                <p className={s.rowMeta}>
                  {d.reference} · {d.produitLabel}
                  {d.client.commune ? ` · ${d.client.commune.name}` : ''}
                </p>
              </div>
              <div className={`${s.rowMain} ${s.rowHideSm}`}>
                <div className={s.chips}>
                  <span className={s.chip}>{d.etatLabel}</span>
                  {d.retours ? <span className={`${s.chip} ${s.chipRed}`}>↺ {d.retours} retour(s)</span> : null}
                  <AvisChip statut={d.avisIa} />
                </div>
                <p className={s.rowMeta}>
                  {[d.agent && `Agent : ${d.agent.displayName}`, d.analyste && `Analyste : ${d.analyste.displayName}`]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <div className={s.rowHideSm} style={{ display: 'flex', justifyContent: 'center' }}>
                <ScoreBadge score={d.score} />
              </div>
              <div className={`${s.rowAmount} ${s.rowHideSm}`}>{money(d.montantSouhaite, d.devise)}</div>
              <div className={s.rowRight}>
                <span className={`${s.chip} ${d.enRetard ? s.chipRed : ''}`}>
                  {d.joursDansEtape === 0 ? 'Aujourd’hui' : `${d.joursDansEtape} j dans l’étape`}
                </span>
                {d.enRetard ? <span className={s.hint}>délai cible dépassé</span> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
