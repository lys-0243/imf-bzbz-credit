'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { money, ROLE_LABELS, useApi, useFile } from '../../lib/poste';
import { ScoreBadge } from './FileTravail';
import s from './poste.module.css';

type Stats = {
  role: string;
  aTraiter: number;
  enRetard: number;
  onglets: Array<{ key: string; label: string; count: number; aTraiter: boolean }>;
  pipeline: Array<{ etape: string; label: string; count: number }>;
  clotures: { accordes: number; rejetes: number };
  retours90j: { versAgent: number; versAnalyste: number };
  accordIa: Array<{ etape: string; label: string; decisions: number; tauxAccord: number | null }>;
  direction: { totalUsd: number; sousSeuil: number; auDessusSeuil: number; seuil: number };
};

/**
 * Barres horizontales, série unique (teinte de la marque), valeur au bout,
 * barre ≤ 18 px, extrémité arrondie côté donnée seulement.
 */
function Barres({
  items,
  max,
  format,
  label,
}: {
  items: Array<{ key: string; label: string; valeur: number; detail?: string }>;
  max: number;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div role="table" aria-label={label}>
      {items.map((x) => {
        const pct = max > 0 ? Math.max(0, Math.min(100, (x.valeur / max) * 100)) : 0;
        return (
          <div
            key={x.key}
            role="row"
            className={s.gaugeRow}
            style={{ gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2.4fr) 90px' }}
            title={`${x.label} : ${format(x.valeur)}${x.detail ? ` (${x.detail})` : ''}`}
          >
            <span role="rowheader">{x.label}</span>
            <span aria-hidden style={{ position: 'relative', height: 18 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${pct}%`,
                  minWidth: x.valeur > 0 ? 3 : 0,
                  borderRadius: '0 4px 4px 0',
                  background: 'var(--imf-blue)',
                }}
              />
            </span>
            <span role="cell" className={s.gaugeValue}>
              {format(x.valeur)}
              {x.detail ? <span className={s.hint}> {x.detail}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, valeur, hint, alerte }: { label: string; valeur: string | number; hint?: string; alerte?: boolean }) {
  return (
    <div className={s.stat} style={alerte ? { background: '#fdecec' } : undefined}>
      <p className={s.statLabel}>{label}</p>
      <p className={s.statValue} style={alerte ? { color: 'var(--imf-red)' } : undefined}>
        {valeur}
      </p>
      {hint ? <p className={s.statHint}>{hint}</p> : null}
    </div>
  );
}

export function TableauDeBord({ base }: { base: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { data: st } = useApi<Stats>('/workflow/stats', { refreshInterval: 60_000 });
  const file = useFile();
  const prochains = (file.data?.dossiers ?? []).filter((d) => d.aTraiter).slice(0, 6);
  const role = user?.role ?? '';
  const direction = role === 'DG' || role === 'DGA' || role === 'CA';
  const maxPipeline = Math.max(1, ...(st?.pipeline.map((p) => p.count) ?? [1]));

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Bonjour {user?.displayName?.split(' ')[0] ?? ''}</h1>
          <p className={s.pageSub}>
            {ROLE_LABELS[role] ?? role} · le copilote prépare les avis à l’entrée de chaque dossier dans votre étape.
          </p>
        </div>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => router.push(`/${base}/file`)}>
          Ouvrir ma file ({st?.aTraiter ?? '…'})
        </button>
      </div>

      <div className={s.grid4}>
        <Stat label="À traiter" valeur={st?.aTraiter ?? '…'} hint="dans votre file" />
        <Stat label="En retard" valeur={st?.enRetard ?? '…'} hint="délai cible dépassé" alerte={Boolean(st?.enRetard)} />
        {direction ? (
          <>
            <Stat label="Montant en décision" valeur={st ? `${money(st.direction.totalUsd)} $` : '…'} hint="direction et Conseil" />
            <Stat
              label={`Seuil Conseil ${st ? money(st.direction.seuil) : ''} $`}
              valeur={st ? `${st.direction.sousSeuil} / ${st.direction.auDessusSeuil}` : '…'}
              hint="sous le seuil / au-delà"
            />
          </>
        ) : (
          <>
            <Stat label="Crédits accordés" valeur={st?.clotures.accordes ?? '…'} hint="clôturés et envoyés au CBS" />
            <Stat
              label="Retours (90 j)"
              valeur={st ? st.retours90j.versAgent + st.retours90j.versAnalyste : '…'}
              hint={st ? `${st.retours90j.versAgent} vers l’agent · ${st.retours90j.versAnalyste} vers l’analyste` : undefined}
            />
          </>
        )}
      </div>

      <div className={s.grid2}>
        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>À traiter maintenant</h2>
              <p className={s.cardSub}>Classés par priorité</p>
            </div>
          </div>
          {prochains.length ? (
            <div className={s.stack} style={{ gap: 8 }}>
              {prochains.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={s.item}
                  style={{ gridTemplateColumns: 'minmax(0,1fr) auto', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                  onClick={() => router.push(`/${base}/${d.id}`)}
                >
                  <span>
                    <span className={s.itemHead}>
                      <strong>{d.client.fullName}</strong>
                      {d.retours ? <span className={`${s.chip} ${s.chipRed}`}>↺ retour</span> : null}
                      {d.enRetard ? <span className={`${s.chip} ${s.chipRed}`}>en retard</span> : null}
                      {d.avisIa === 'PRET' ? <span className={`${s.chip} ${s.chipBlue}`}>✦ avis prêt</span> : null}
                    </span>
                    <span className={s.itemFix}>
                      {d.etatLabel} · {money(d.montantSouhaite, d.devise)} · {d.joursDansEtape} j
                    </span>
                  </span>
                  <ScoreBadge score={d.score} />
                </button>
              ))}
            </div>
          ) : (
            <p className={s.empty}>Rien en attente. Beau travail.</p>
          )}
        </section>

        <section className={s.card}>
          <div className={s.cardHead}>
            <div>
              <h2 className={s.cardTitle}>Dossiers par étape</h2>
              <p className={s.cardSub}>Ensemble du circuit, en cours</p>
            </div>
          </div>
          {st ? (
            <Barres
              label="Dossiers par étape"
              items={st.pipeline.map((p) => ({ key: p.etape, label: p.label, valeur: p.count }))}
              max={maxPipeline}
              format={(v) => String(v)}
            />
          ) : (
            <div className={s.skeleton} style={{ height: 180 }} />
          )}
        </section>
      </div>

      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2 className={s.cardTitle}>Accord des décideurs avec l’IA</h2>
            <p className={s.cardSub}>
              Part des décisions humaines conformes à l’avis du copilote, 90 derniers jours. Un écart n’est pas une erreur : il est justifié et
              sert à améliorer les avis.
            </p>
          </div>
        </div>
        {st?.accordIa.length ? (
          <Barres
            label="Taux d’accord avec l’IA par étape"
            items={st.accordIa.map((a) => ({
              key: a.etape,
              label: a.label,
              valeur: Math.round((a.tauxAccord ?? 0) * 100),
              detail: `· ${a.decisions} déc.`,
            }))}
            max={100}
            format={(v) => `${v} %`}
          />
        ) : (
          <p className={s.hint}>Pas encore de décisions sur la période.</p>
        )}
      </section>
    </div>
  );
}
