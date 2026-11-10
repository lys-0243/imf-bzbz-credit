'use client';

import {
  CLASSE_RISQUE_LABELS,
  computeCf24Ratios,
  ETAPE_WORKFLOW_LABELS,
  montantSouhaiteFromPayload,
  PRONOSTIC_RECOMMANDATION_LABELS,
  type PronosticAvis,
  type ScoreCredit,
  computeCf5Totaux,
  normalizeFormulaire,
  type ParametresImf,
} from '@imf/shared';
import { money, ROLE_LABELS, useApi, type DossierPoste } from '../../lib/poste';
import s from './poste.module.css';

/** Anneau du score (0–100), une seule teinte ; la classe porte le sens. */
export function ScoreRing({ total, classe }: { total: number; classe: ScoreCredit['classe'] }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, total));
  return (
    <svg className={s.scoreRing} viewBox="0 0 92 92" role="img" aria-label={`Score ${v} sur 100, classe ${classe}`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="#ececec" strokeWidth="8" />
      <circle
        cx="46"
        cy="46"
        r={r}
        fill="none"
        stroke="var(--imf-blue)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="44" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111">
        {v}
      </text>
      <text x="46" y="62" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5c5c5c">
        classe {classe}
      </text>
    </svg>
  );
}

/** Barres horizontales 0–100 par pilier (série unique). */
export function PiliersBars({ score, comparer }: { score: ScoreCredit; comparer?: ScoreCredit | null }) {
  return (
    <div>
      {score.piliers.map((p) => {
        const ref = comparer?.piliers.find((x) => x.pilier === p.pilier)?.score;
        return (
          <div key={p.pilier} className={s.gaugeRow} title={p.details.join('\n')}>
            <span>
              {p.label} <span className={s.hint}>· {Math.round(p.poids * 100)} %</span>
            </span>
            <span className={s.gaugeTrack} aria-hidden>
              <span className={s.gaugeFill} style={{ width: `${p.score}%` }} />
              {ref != null && ref !== p.score ? <span className={s.gaugeMark} style={{ left: `${ref}%` }} title={`Moteur : ${ref}`} /> : null}
            </span>
            <span className={s.gaugeValue}>
              {p.score}
              {ref != null && ref !== p.score ? (
                <span className={s.hint}> ({p.score > ref ? '+' : ''}{p.score - ref})</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function fmtRatio(v: number | null, pct: boolean) {
  if (v == null) return '—';
  return pct ? `${Math.round(v * 1000) / 10} %` : String(Math.round(v * 100) / 100);
}

export function SyntheseDecision({ d }: { d: DossierPoste }) {
  const pronostic = useApi<{ avis: PronosticAvis } | null>(`/scoring/dossiers/${d.id}/pronostic`);
  const parametres = useApi<ParametresImf>('/parametres');
  const payload = (d.payload ?? {}) as Record<string, any>;
  const { montantSouhaite, devise } = montantSouhaiteFromPayload(payload);
  const decision = (etape: string) => [...d.decisions].reverse().find((x) => x.etape === etape);
  const pv = d.formulaires?.DECISION_COMITE as { decision?: string; montantApprouve?: string } | undefined;
  const rapport = d.formulaires?.RAPPORT_ANALYSE as { montantPropose?: string } | undefined;

  const montants: Array<{ label: string; valeur: number | null | undefined; ia?: boolean }> = [
    { label: 'Demandé', valeur: montantSouhaite },
    { label: 'Proposé par l’IA', valeur: pronostic.data?.avis?.montantSuggere, ia: true },
    { label: 'Retenu par l’agent', valeur: decision('AGENT')?.montantRetenu },
    { label: 'Analyste', valeur: decision('ANALYSE')?.montantRetenu ?? (Number(rapport?.montantPropose) || null) },
    { label: 'Responsable crédit', valeur: decision('VALIDATION_RC')?.montantRetenu },
    {
      label: 'Approuvé (PV)',
      valeur: pv?.decision === 'APPROUVE' ? Number(pv.montantApprouve) || null : decision('DIRECTION')?.montantRetenu,
    },
  ];

  const score = d.scoreReasons?.retenu ?? null;
  // Σ gages = total CF5.1 du demandeur (caution sur le montant proposé), comme la CF 2.4.
  const totalCf5 =
    d.analyseCf2 && parametres.data
      ? computeCf5Totaux(normalizeFormulaire('CF5_1_DEMANDEUR', d.formulaires?.CF5_1_DEMANDEUR), {
          montantPropose: Number(String(d.analyseCf2.cf25?.montantPropose ?? '').replace(',', '.')) || 0,
          cautionPct: parametres.data.conditions.cautionPct,
        }).total
      : null;
  const ratios = d.analyseCf2
    ? computeCf24Ratios(d.analyseCf2, totalCf5 != null ? { valeurGaranties: totalCf5 } : {})
    : [];
  const conformite = d.formulaires?.AVIS_CONFORMITE as { decision?: string; constats?: Array<{ statut: string; exigence: string }> } | undefined;
  const drapeaux: Array<{ texte: string; grave: boolean }> = [
    ...(score?.eliminatoires ?? []).map((t) => ({ texte: t, grave: true })),
    ...(conformite?.constats ?? []).filter((c) => c.statut === 'NON_CONFORME').map((c) => ({ texte: `Non conforme : ${c.exigence}`, grave: true })),
    ...ratios.filter((r) => r.ok === false).map((r) => ({ texte: `${r.label} hors norme (${fmtRatio(r.value, r.asPercent)}, norme ${r.norme})`, grave: r.key === 'dsr' })),
    ...(d.cbs?.statut === 'ECHEC' ? [{ texte: `Envoi CBS en échec : ${d.cbs.dernierMessage ?? ''}`, grave: true }] : []),
    ...(!payload.numeroCompte ? [{ texte: 'Numéro de compte client absent (envoi CBS impossible)', grave: false }] : []),
  ];

  return (
    <div className={s.stack}>
      <section className={s.card} aria-labelledby="syn-montants">
        <div className={s.cardHead}>
          <h3 id="syn-montants" className={s.cardTitle}>Montants à chaque étape</h3>
          {d.seuil.montantUsd != null ? (
            <span className={`${s.chip} ${d.seuil.montantUsd > d.seuil.seuilConseilUsd ? s.chipAmber : s.chipGreen}`}>
              {d.seuil.montantUsd > d.seuil.seuilConseilUsd
                ? `> ${d.seuil.seuilConseilUsd} $ : Conseil d’administration`
                : `≤ ${d.seuil.seuilConseilUsd} $ : décision de la direction`}
            </span>
          ) : null}
        </div>
        <div className={s.amounts}>
          {montants.map((m) => (
            <div key={m.label} className={`${s.amount} ${m.ia ? s.amountIa : ''}`}>
              <p className={s.amountLabel}>{m.ia ? '✦ ' : ''}{m.label}</p>
              <p className={s.amountValue}>{money(m.valeur, devise)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className={s.grid2}>
        <section className={s.card} aria-labelledby="syn-score">
          <div className={s.cardHead}>
            <h3 id="syn-score" className={s.cardTitle}>Score de crédit</h3>
            {score ? <span className={s.chip}>{CLASSE_RISQUE_LABELS[score.classe]}</span> : null}
          </div>
          {score ? (
            <>
              <div className={s.scoreHero}>
                <ScoreRing total={score.total} classe={score.classe} />
                <div className={s.scoreText}>
                  <p className={s.scoreBig}>{score.total}/100 retenu par l’analyste</p>
                  <p style={{ margin: '4px 0 0' }}>
                    Moteur {d.scoreReasons?.moteur.total} · proposé par l’IA {d.scoreReasons?.propose.total}
                  </p>
                  {d.scoreReasons?.commentaire ? <p style={{ margin: '4px 0 0' }}>« {d.scoreReasons.commentaire} »</p> : null}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <PiliersBars score={score} comparer={d.scoreReasons?.moteur} />
              </div>
              <p className={s.hint}>Le trait vertical marque la note du moteur quand elle diffère.</p>
            </>
          ) : (
            <p className={s.hint}>Le score est calculé et validé à l’étape d’analyse.</p>
          )}
        </section>

        <section className={s.card} aria-labelledby="syn-ratios">
          <div className={s.cardHead}>
            <h3 id="syn-ratios" className={s.cardTitle}>Ratios CF 2.4</h3>
            <span className={s.hint}>sur la proposition de l’agent</span>
          </div>
          {ratios.length ? (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Ratio</th>
                  <th className={s.num}>Valeur</th>
                  <th>Norme</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ratios.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td className={s.num}>{fmtRatio(r.value, r.asPercent)}</td>
                    <td>{r.norme}</td>
                    <td>
                      {r.ok == null ? (
                        <span className={s.chip}>— n/c</span>
                      ) : r.ok ? (
                        <span className={`${s.chip} ${s.chipGreen}`}>✓ conforme</span>
                      ) : (
                        <span className={`${s.chip} ${s.chipRed}`}>✕ hors norme</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={s.hint}>Analyse financière CF2 non applicable ou non renseignée.</p>
          )}
        </section>
      </div>

      <section className={s.card} aria-labelledby="syn-risques">
        <h3 id="syn-risques" className={s.cardTitle} style={{ marginBottom: 10 }}>
          Points d’attention
        </h3>
        {drapeaux.length ? (
          <div className={s.chips}>
            {drapeaux.map((x, i) => (
              <span key={i} className={`${s.chip} ${x.grave ? s.chipRed : s.chipAmber}`}>
                {x.grave ? '⚠' : '•'} {x.texte}
              </span>
            ))}
          </div>
        ) : (
          <p className={s.okText}>✓ Aucun drapeau : critères éliminatoires, conformité et ratios sans alerte.</p>
        )}
      </section>

      <section className={s.card} aria-labelledby="syn-decisions">
        <h3 id="syn-decisions" className={s.cardTitle} style={{ marginBottom: 10 }}>
          Décisions humaines et avis IA
        </h3>
        {d.decisions.length ? (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Étape</th>
                <th>Décideur</th>
                <th>Décision</th>
                <th className={s.num}>Montant</th>
                <th>Avec l’IA</th>
              </tr>
            </thead>
            <tbody>
              {d.decisions.map((x) => (
                <tr key={x.id}>
                  <td>{x.etape ? ETAPE_WORKFLOW_LABELS[x.etape] : ROLE_LABELS[x.role]}</td>
                  <td>
                    {x.acteur.displayName}
                    <div className={s.hint}>{ROLE_LABELS[x.role]}</div>
                  </td>
                  <td>
                    {PRONOSTIC_RECOMMANDATION_LABELS[x.recommandation]}
                    {x.commentaire ? <div className={s.hint}>« {x.commentaire} »</div> : null}
                  </td>
                  <td className={s.num}>{money(x.montantRetenu, devise)}</td>
                  <td>
                    {x.accordAvecIa == null ? (
                      <span className={s.hint}>—</span>
                    ) : x.accordAvecIa ? (
                      <span className={`${s.chip} ${s.chipGreen}`}>✓ conforme à l’avis</span>
                    ) : (
                      <span className={`${s.chip} ${s.chipAmber}`}>≠ s’en écarte (justifié)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={s.hint}>Aucune décision enregistrée pour l’instant.</p>
        )}
      </section>
    </div>
  );
}
