'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CLASSE_RISQUE_LABELS,
  GRAVITE_ANOMALIE_LABELS,
  PILIER_SCORE_LABELS,
  PRONOSTIC_RECOMMANDATION_LABELS,
  referenceSection,
  STATUT_CONSTAT_LABELS,
  TYPE_AVIS_IA_LABELS,
  type Anomalie,
  type AvisAnalyse,
  type AvisConformiteIa,
  type AvisSynthese,
  type ControleDossier,
  type TypeAvisIa,
  NOM_ASSISTANT_IA,
} from '@imf/shared';
import { ApiError } from '../../lib/api';
import { ilYa, money, useAvis, type AvisIa } from '../../lib/poste';
import { useBrouillon } from './brouillon';
import s from './poste.module.css';

function Spark() {
  return (
    <svg className={s.iaSpark} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.8L12 17l-1.8-5.8L5 9.4l5.2-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity=".7" />
    </svg>
  );
}

/** En-tête commun, états de préparation et régénération d'un avis IA. */
export function AvisCard<T extends TypeAvisIa>({
  dossierId,
  type,
  peutGenerer,
  titre,
  children,
}: {
  dossierId: string;
  type: T;
  peutGenerer: boolean;
  titre?: string;
  children: (avis: AvisIa<any>) => ReactNode;
}) {
  const { data, avis, demander, isLoading } = useAvis(dossierId, type);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enPreparation = data?.statut === 'EN_ATTENTE' || data?.statut === 'EN_COURS';
  // Dossier entré dans l'étape avant la pré-génération : on lance l'avis à l'ouverture.
  const lance = useRef(false);
  useEffect(() => {
    if (peutGenerer && !isLoading && data === null && !lance.current) {
      lance.current = true;
      void demander().catch(() => undefined);
    }
  }, [peutGenerer, isLoading, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const relancer = async () => {
    setBusy(true);
    setErreur(null);
    try {
      await demander();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.ia} aria-live="polite">
      <div className={s.iaHead}>
        <div>
          <h2 className={s.iaTitle}>
            <Spark /> {titre ?? TYPE_AVIS_IA_LABELS[type]}
          </h2>
          {avis ? (
            <p className={s.iaMeta}>
              {avis.source === 'IA' ? NOM_ASSISTANT_IA : `Règles (${NOM_ASSISTANT_IA} indisponible)`} · {ilYa(avis.updatedAt)}
            </p>
          ) : null}
        </div>
        {peutGenerer ? (
          <button
            type="button"
            className={`${s.btn} ${s.btnGhost}`}
            onClick={() => void relancer()}
            disabled={busy || enPreparation}
            title="Relancer l’analyse sur les données actuelles"
          >
            ↻ {avis ? 'Régénérer' : 'Générer'}
          </button>
        ) : null}
      </div>

      {enPreparation ? (
        <div className={s.preparing}>
          <span className={s.spin} aria-hidden /> Le copilote prépare son avis…
        </div>
      ) : null}
      {data?.statut === 'ECHEC' ? <p className={s.iaError}>Échec de la préparation : {data.erreurIa}</p> : null}
      {avis && avis.aJour === false ? (
        <p className={s.iaWarn}>Les données ont changé depuis cet avis : régénérez-le pour en tenir compte.</p>
      ) : null}
      {avis?.source === 'REGLES' && avis.erreurIa ? (
        <p className={s.iaWarn}>Avis calculé par les règles : {avis.erreurIa}</p>
      ) : null}
      {erreur ? <p className={s.iaError}>{erreur}</p> : null}

      {avis?.contenu ? (
        <div className={s.iaBody}>{children(avis)}</div>
      ) : !enPreparation && !isLoading && !data ? (
        <p className={s.hint} style={{ marginTop: 10 }}>
          Aucun avis pour cette étape.{peutGenerer ? ' Lancez la génération.' : ''}
        </p>
      ) : null}

      <p className={s.iaNotice}>Avis consultatif — la décision vous appartient et chaque écart est tracé.</p>
    </section>
  );
}

function Liste({ titre, items }: { titre: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className={s.iaSection}>
      <p className={s.iaLabel}>{titre}</p>
      <ul className={s.bullets}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

const GRAVITE_CHIP: Record<string, string> = { BLOQUANTE: s.chipRed, MAJEURE: s.chipAmber, MINEURE: '' };

/** Anomalies sélectionnables (pour un renvoi à l'agent). */
export function ListeAnomalies({ anomalies, selectionnable }: { anomalies: Anomalie[]; selectionnable: boolean }) {
  const { brouillon, basculerPoint } = useBrouillon();
  const [tout, setTout] = useState(false);
  const visibles = tout ? anomalies : anomalies.slice(0, 8);
  if (!anomalies.length) return <p className={s.okText}>✓ Aucune anomalie relevée.</p>;
  return (
    <div className={s.iaSection}>
      <p className={s.iaLabel}>
        {anomalies.length} point(s) à examiner{selectionnable ? ' — cochez ceux à renvoyer' : ''}
      </p>
      {visibles.map((a) => {
        const choisi = brouillon.details.some((x) => x.id === a.id);
        return (
          <label key={a.id} className={`${s.item} ${choisi ? s.itemSelected : ''}`}>
            {selectionnable ? (
              <input
                type="checkbox"
                checked={choisi}
                onChange={() =>
                  basculerPoint({ id: a.id, constat: a.constat, correction: a.correction, gravite: a.gravite, rubrique: a.rubrique })
                }
              />
            ) : (
              <span />
            )}
            <span>
              <span className={s.itemHead}>
                <span className={`${s.chip} ${GRAVITE_CHIP[a.gravite]}`}>{GRAVITE_ANOMALIE_LABELS[a.gravite]}</span>
                <span className={s.chip}>{a.rubrique}</span>
                {a.source === 'IA' ? <span className={`${s.chip} ${s.chipBlue}`}>✦ IA</span> : <span className={s.chip}>règle</span>}
              </span>
              <p className={s.itemText}>{a.constat}</p>
              {a.correction ? <p className={s.itemFix}>→ {a.correction}</p> : null}
            </span>
          </label>
        );
      })}
      {anomalies.length > 8 ? (
        <button type="button" className={s.linkBtn} onClick={() => setTout((t) => !t)}>
          {tout ? 'Réduire' : `Voir les ${anomalies.length - 8} autres`}
        </button>
      ) : null}
    </div>
  );
}

export function VueControle({ c, selectionnable }: { c: ControleDossier; selectionnable: boolean }) {
  return (
    <>
      <p style={{ margin: 0 }}>{c.synthese}</p>
      <ListeAnomalies anomalies={c.anomalies} selectionnable={selectionnable} />
      <Liste titre="Points forts" items={c.pointsForts} />
    </>
  );
}

export function VueAnalyse({ avis, actif }: { avis: AvisIa<AvisAnalyse>; actif: boolean }) {
  const { brouillon, maj, toast } = useBrouillon();
  const c = avis.contenu!;
  const { moteur, propose, ajustements } = c.score;
  return (
    <>
      <p style={{ margin: 0 }}>{c.controle.synthese}</p>

      <div className={s.iaSection}>
        <p className={s.iaLabel}>Score proposé</p>
        <div className={s.iaReco}>
          <div>
            <p className={s.iaRecoValue}>
              {propose.total}/100 · classe {propose.classe}
            </p>
            <p className={s.hint} style={{ margin: 0 }}>
              moteur {moteur.total} · {CLASSE_RISQUE_LABELS[propose.classe]}
            </p>
          </div>
          <span className={`${s.scoreBadge} ${s[`classe${propose.classe}`]}`}>{propose.classe}</span>
        </div>
        {ajustements.length ? (
          <ul className={s.bullets}>
            {ajustements.map((a) => (
              <li key={a.pilier}>
                <strong>
                  {PILIER_SCORE_LABELS[a.pilier]} {a.delta > 0 ? '+' : ''}
                  {a.delta}
                </strong>{' '}
                — {a.justification}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.hint} style={{ margin: 0 }}>Aucun ajustement : le score moteur est repris tel quel.</p>
        )}
        {moteur.eliminatoires.length ? (
          <p className={s.iaError}>Critère éliminatoire : {moteur.eliminatoires.join(' ; ')}</p>
        ) : null}
      </div>

      <div className={s.iaSection}>
        <p className={s.iaLabel}>Proposition de rapport</p>
        <div className={s.iaReco}>
          <div>
            <p className={s.iaRecoValue}>{PRONOSTIC_RECOMMANDATION_LABELS[c.rapport.recommandation]}</p>
            <p className={s.hint} style={{ margin: 0 }}>
              {c.rapport.montantPropose != null ? `${money(c.rapport.montantPropose)} sur ${c.rapport.dureeMois ?? '—'} mois` : 'sans montant'}
            </p>
          </div>
          {actif ? (
            <button
              type="button"
              className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
              onClick={() => {
                maj({
                  rapport: {
                    synthese: c.rapport.synthese,
                    analyseFinanciere: c.rapport.analyseFinanciere,
                    coherenceTerrain: c.rapport.coherenceTerrain,
                    analyseRisques: c.rapport.analyseRisques,
                    recommandation: c.rapport.recommandation,
                    montantPropose: c.rapport.montantPropose != null ? String(c.rapport.montantPropose) : '',
                    dureeMois: c.rapport.dureeMois != null ? String(c.rapport.dureeMois) : '',
                    conditions: c.rapport.conditions.join('\n'),
                    avisIaId: avis.id,
                  },
                });
                toast('Brouillon de rapport repris : relisez-le dans l’onglet Décision');
              }}
            >
              Reprendre
            </button>
          ) : null}
        </div>
      </div>

      <ListeAnomalies anomalies={c.controle.anomalies} selectionnable={actif} />
      {actif && brouillon.details.length ? (
        <button
          type="button"
          className={`${s.btn} ${s.btnSecondary}`}
          onClick={() =>
            maj({
              action: 'RETOUR_AGENT',
              motif:
                brouillon.motif ||
                `Merci de corriger ${brouillon.details.length} point(s) relevé(s) lors de la contre-vérification.`,
            })
          }
        >
          Préparer le renvoi à l’agent ({brouillon.details.length})
        </button>
      ) : null}
      <Liste titre="Points forts" items={c.controle.pointsForts} />
    </>
  );
}

const STATUT_CHIP: Record<string, string> = { CONFORME: s.chipGreen, NON_CONFORME: s.chipRed, A_VERIFIER: s.chipAmber };

export function VueConformite({ avis, actif }: { avis: AvisIa<AvisConformiteIa>; actif: boolean }) {
  const { brouillon, maj, basculerPoint, toast } = useBrouillon();
  const c = avis.contenu!;
  const [ouvert, setOuvert] = useState<string | null>(null);
  const extrait = (id: string) => c.extraits.find((x) => x.sectionId === id);
  return (
    <>
      <div className={s.iaReco}>
        <div>
          <p className={s.iaLabel}>Verdict</p>
          <p className={s.iaRecoValue}>{STATUT_CONSTAT_LABELS[c.verdict]}</p>
        </div>
        <span className={`${s.chip} ${STATUT_CHIP[c.verdict]}`}>
          {c.constats.filter((x) => x.statut === 'NON_CONFORME').length} non conforme(s) ·{' '}
          {c.constats.filter((x) => x.statut === 'A_VERIFIER').length} à vérifier
        </span>
      </div>
      <p style={{ margin: 0 }}>{c.resume}</p>
      <p className={s.hint} style={{ margin: 0 }}>
        Manuels consultés : {c.manuels.map((m) => `${m.titre} (v${m.version})`).join(', ') || 'aucun'}
        {c.citationsRetirees ? ` · ${c.citationsRetirees} citation(s) invérifiable(s) écartée(s)` : ''}
      </p>
      <div className={s.iaSection}>
        {c.constats.map((x, i) => {
          const id = `C${i + 1}`;
          const choisi = brouillon.details.some((p) => p.id === id);
          return (
            <div key={id} className={`${s.item} ${choisi ? s.itemSelected : ''}`}>
              {actif && x.statut !== 'CONFORME' ? (
                <input
                  type="checkbox"
                  aria-label={`Retenir : ${x.exigence}`}
                  checked={choisi}
                  onChange={() => basculerPoint({ id, constat: x.exigence, correction: x.commentaire, gravite: x.statut })}
                />
              ) : (
                <span />
              )}
              <div>
                <div className={s.itemHead}>
                  <span className={`${s.chip} ${STATUT_CHIP[x.statut]}`}>{STATUT_CONSTAT_LABELS[x.statut]}</span>
                </div>
                <p className={s.itemText}>
                  <strong>{x.exigence}</strong>
                </p>
                {x.commentaire ? <p className={s.itemFix}>{x.commentaire}</p> : null}
                {x.sectionIds.map((sid) => {
                  const e = extrait(sid);
                  if (!e) return null;
                  return (
                    <div key={sid}>
                      <button type="button" className={s.linkBtn} onClick={() => setOuvert(ouvert === `${id}:${sid}` ? null : `${id}:${sid}`)}>
                        📖 {referenceSection(e)}
                      </button>
                      {ouvert === `${id}:${sid}` ? (
                        <p className={s.quote}>{e.contenu}</p>
                      ) : x.citation ? (
                        <p className={s.quote}>« {x.citation} »</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {actif ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
            onClick={() => {
              maj({
                constats: c.constats.map((x, i) => ({
                  id: `C${i + 1}`,
                  exigence: x.exigence,
                  statut: x.statut,
                  commentaire: x.commentaire,
                  references: x.sectionIds.map((sid) => (extrait(sid) ? referenceSection(extrait(sid)!) : '')).filter(Boolean).join(' ; '),
                  sectionIds: x.sectionIds,
                })),
              });
              toast('Constats repris dans l’avis de conformité (onglet Décision)');
            }}
          >
            Reprendre les constats
          </button>
          {brouillon.details.length ? (
            <button
              type="button"
              className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
              onClick={() =>
                maj({
                  action: 'RETOUR_ANALYSTE',
                  motif: brouillon.motif || `${brouillon.details.length} exigence(s) des manuels à traiter avant validation.`,
                })
              }
            >
              Préparer le retour à l’analyste ({brouillon.details.length})
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function VueSynthese({
  avis,
  actif,
  cible,
}: {
  avis: AvisIa<AvisSynthese>;
  actif: boolean;
  /** Ce que « Reprendre » pré-remplit : décision chiffrée (RC) ou PV (direction / conseil). */
  cible: 'decision' | 'pv';
}) {
  const { maj, toast } = useBrouillon();
  const c = avis.contenu!;
  return (
    <>
      <div className={s.iaReco}>
        <div>
          <p className={s.iaLabel}>Recommandation</p>
          <p className={s.iaRecoValue}>{PRONOSTIC_RECOMMANDATION_LABELS[c.recommandation]}</p>
          <p className={s.hint} style={{ margin: 0 }}>
            {c.montantSuggere != null ? `${money(c.montantSuggere)} sur ${c.dureeSuggereeMois ?? '—'} mois` : 'sans montant'}
          </p>
        </div>
        {actif ? (
          <button
            type="button"
            className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
            onClick={() => {
              if (cible === 'decision') {
                maj({
                  decision: {
                    recommandation: c.recommandation,
                    montant: c.montantSuggere != null ? String(c.montantSuggere) : '',
                    dureeMois: c.dureeSuggereeMois != null ? String(c.dureeSuggereeMois) : '',
                  },
                });
              } else {
                maj({
                  pv: {
                    montant: c.montantSuggere != null ? String(c.montantSuggere) : '',
                    dureeMois: c.dureeSuggereeMois != null ? String(c.dureeSuggereeMois) : '',
                    observations: c.conditions.length ? `Conditions : ${c.conditions.join(' ; ')}` : '',
                  },
                });
              }
              toast('Proposition reprise : vérifiez-la avant de décider');
            }}
          >
            Reprendre
          </button>
        ) : null}
      </div>
      {c.routage ? (
        <span className={`${s.chip} ${c.routage === 'CONSEIL' ? s.chipAmber : s.chipGreen}`}>
          {c.routage === 'CONSEIL'
            ? 'Au-delà du seuil : l’approbation de la direction transmettra au Conseil'
            : 'Sous le seuil : l’approbation de la direction clôturera la demande'}
        </span>
      ) : null}
      <p style={{ margin: 0 }}>{c.resume}</p>
      <div className={s.iaSection}>
        <p className={s.iaLabel}>Contrôles automatiques</p>
        {c.controles.map((x) => (
          <div key={x.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className={`${s.chip} ${x.ok ? s.chipGreen : s.chipRed}`}>{x.ok ? '✓' : '✕'}</span>
            <span>
              {x.label} <span className={s.hint}>— {x.detail}</span>
            </span>
          </div>
        ))}
      </div>
      <Liste titre="Points clés" items={c.pointsCles} />
      <Liste titre="Points ouverts" items={c.pointsOuverts} />
      <Liste titre="Conditions proposées" items={c.conditions} />
    </>
  );
}
