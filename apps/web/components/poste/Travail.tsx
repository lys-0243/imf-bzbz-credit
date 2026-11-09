'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CLASSE_RISQUE_LABELS,
  normalizeAvisConformite,
  normalizeRapportAnalyse,
  PILIERS_SCORE,
  PILIER_SCORE_LABELS,
  rapportAnalyseManquants,
  STATUTS_CONSTAT,
  STATUT_CONSTAT_LABELS,
  type AvisConformiteData,
  type PilierScore,
  type RapportAnalyseData,
  type SuggestionAgents,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { money, rafraichir, useApi, useAvis, type ApercuScore, type DossierPoste } from '../../lib/poste';
import { useBrouillon } from './brouillon';
import { PiliersBars, ScoreRing } from './SyntheseDecision';
import s from './poste.module.css';

function msg(e: unknown) {
  return e instanceof ApiError ? e.message : 'Erreur inattendue';
}

async function enregistrerFormulaire(id: string, code: string, data: unknown) {
  await apiFetch(`/instruction/dossiers/${id}/formulaires/${code}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

// ── Attribution (RC) ───────────────────────────────────────

type AgentCharge = {
  id: string;
  displayName: string;
  zone: { name: string } | null;
  dossiersActifs: number;
};

export function AttributionPanel({ d, onFait }: { d: DossierPoste; onFait: () => void }) {
  const { avis } = useAvis(d.id, 'SUGGESTION_AGENTS');
  const agents = useApi<AgentCharge[]>('/affectation/agents');
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [autre, setAutre] = useState('');
  const { toast } = useBrouillon();
  const suggestion = avis?.contenu as SuggestionAgents | undefined;

  const attribuer = async (agentId: string, nom: string) => {
    setBusy(agentId);
    setErreur(null);
    try {
      await apiFetch(`/affectation/dossiers/${d.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId, avisIaId: avis?.id }),
      });
      toast(`Dossier attribué à ${nom}`);
      await rafraichir('/workflow/file');
      onFait();
    } catch (e) {
      setErreur(msg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>Attribuer à un agent de crédit</h3>
          <p className={s.cardSub}>Le copilote classe les agents ; vous choisissez.</p>
        </div>
      </div>
      <div className={s.stack} style={{ gap: 10 }}>
        {(suggestion?.candidats ?? []).slice(0, 5).map((c) => (
          <div key={c.agentId} className={s.item} style={{ alignItems: 'center' }}>
            <span className={`${s.scoreBadge} ${c.rang === 1 ? s.classeA : s.classeB}`} style={{ background: c.rang === 1 ? undefined : '#5f6f99' }}>
              {c.rang}
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className={s.itemText}>
                  <strong>{c.displayName}</strong> {c.zoneName ? <span className={s.hint}>· {c.zoneName}</span> : null}
                </p>
                <p className={s.itemFix}>{c.justification}</p>
              </div>
              <button
                type="button"
                className={`${s.btn} ${c.rang === 1 ? s.btnPrimary : s.btnSecondary} ${s.btnSmall}`}
                disabled={busy != null}
                onClick={() => void attribuer(c.agentId, c.displayName)}
              >
                {busy === c.agentId ? 'Attribution…' : 'Attribuer'}
              </button>
            </div>
          </div>
        ))}
        {!suggestion ? <p className={s.hint}>Suggestions en préparation… vous pouvez aussi choisir dans la liste.</p> : null}
        <div className={s.field}>
          <label className={s.label} htmlFor="autre-agent">
            Ou choisir un autre agent
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select id="autre-agent" className={s.select} value={autre} onChange={(e) => setAutre(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {(agents.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} {a.zone ? `(${a.zone.name})` : ''} — {a.dossiersActifs} en cours
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${s.btn} ${s.btnSecondary}`}
              disabled={!autre || busy != null}
              onClick={() => {
                const a = agents.data?.find((x) => x.id === autre);
                if (a) void attribuer(a.id, a.displayName);
              }}
            >
              Attribuer
            </button>
          </div>
        </div>
        {erreur ? <p className={s.errorText}>{erreur}</p> : null}
      </div>
    </section>
  );
}

// ── Score (analyste) ───────────────────────────────────────

export function ScorePanel({ d, actif }: { d: DossierPoste; actif: boolean }) {
  const rapport = normalizeRapportAnalyse(d.formulaires?.RAPPORT_ANALYSE);
  const [montant, setMontant] = useState(rapport.montantPropose);
  const [duree, setDuree] = useState(rapport.dureeMois);
  const [q, setQ] = useState({ montant: rapport.montantPropose, duree: rapport.dureeMois });
  useEffect(() => {
    const t = window.setTimeout(() => setQ({ montant, duree }), 450);
    return () => window.clearTimeout(t);
  }, [montant, duree]);
  const apercu = useApi<ApercuScore>(
    `/analyse/dossiers/${d.id}/score?${new URLSearchParams({
      ...(Number(q.montant) > 0 ? { montant: q.montant } : {}),
      ...(Number(q.duree) > 0 ? { dureeMois: q.duree } : {}),
    })}`,
  );
  const a = apercu.data;
  const [notes, setNotes] = useState<Partial<Record<PilierScore, number>>>({});
  const [commentaire, setCommentaire] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { toast } = useBrouillon();

  // Notes initiales = proposition IA (ou score déjà validé).
  useEffect(() => {
    if (!a) return;
    const base = a.valide && !a.valide.perime ? a.valide.retenu : a.propose;
    setNotes(Object.fromEntries(base.piliers.map((p) => [p.pilier, p.score])));
  }, [a?.propose.total, a?.valide?.valideLe]); // eslint-disable-line react-hooks/exhaustive-deps

  const retenu = useMemo(() => {
    if (!a) return null;
    const piliers = a.moteur.piliers.map((p) => ({ ...p, score: notes[p.pilier] ?? p.score }));
    const somme = piliers.reduce((t, p) => t + p.poids, 0) || 1;
    let total = piliers.reduce((t, p) => t + p.score * p.poids, 0) / somme;
    if (a.moteur.eliminatoires.length) total = Math.min(total, a.grille.plafondEliminatoire);
    total = Math.round(total);
    const g = a.grille.seuilsClasses;
    const classe = a.moteur.eliminatoires.length ? 'E' : total >= g.A ? 'A' : total >= g.B ? 'B' : total >= g.C ? 'C' : total >= g.D ? 'D' : 'E';
    return { ...a.moteur, piliers, total, classe } as typeof a.moteur;
  }, [a, notes]);
  const ecart = a && retenu ? Math.abs(retenu.total - a.propose.total) >= a.grille.ecartCommentaire : false;

  const valider = async () => {
    setBusy(true);
    setErreur(null);
    try {
      await apiFetch(`/analyse/dossiers/${d.id}/score`, {
        method: 'PUT',
        body: JSON.stringify({
          notes,
          commentaire: commentaire.trim() || undefined,
          montant: Number(montant) > 0 ? Number(montant) : undefined,
          dureeMois: Number(duree) > 0 ? Math.round(Number(duree)) : undefined,
        }),
      });
      toast('Score validé');
      await Promise.all([apercu.mutate(), rafraichir(`/instruction/dossiers/${d.id}`), rafraichir('/workflow/file')]);
    } catch (e) {
      setErreur(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!a || !retenu) {
    return <section className={s.card}><div className={s.skeleton} style={{ height: 220 }} /></section>;
  }
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>Score de crédit</h3>
          <p className={s.cardSub}>
            Calcul du moteur sur le montant et la durée évalués ; l’IA propose des ajustements bornés (±{a.grille.margeIaParPilier}) ; vous validez.
          </p>
        </div>
        {a.valide ? (
          <span className={`${s.chip} ${a.valide.perime ? s.chipAmber : s.chipGreen}`}>
            {a.valide.perime ? 'Validé — à revalider (dossier modifié)' : `✓ Validé : ${a.valide.retenu.total}`}
          </span>
        ) : null}
      </div>

      <div className={s.grid3} style={{ marginBottom: 14 }}>
        <div className={s.field}>
          <label className={s.label} htmlFor="sc-montant">Montant évalué</label>
          <input id="sc-montant" className={s.input} inputMode="decimal" value={montant} placeholder={a.montant != null ? String(a.montant) : ''} onChange={(e) => setMontant(e.target.value)} disabled={!actif} />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="sc-duree">Durée (mois)</label>
          <input id="sc-duree" className={s.input} inputMode="numeric" value={duree} placeholder={a.dureeMois != null ? String(a.dureeMois) : ''} onChange={(e) => setDuree(e.target.value)} disabled={!actif} />
        </div>
        <div className={s.stat}>
          <p className={s.statLabel}>Moteur · IA · retenu</p>
          <p className={s.statValue}>
            {a.moteur.total} <span className={s.hint}>›</span> {a.propose.total} <span className={s.hint}>›</span> {retenu.total}
          </p>
        </div>
      </div>

      <div className={s.scoreHero}>
        <ScoreRing total={retenu.total} classe={retenu.classe} />
        <div className={s.scoreText}>
          <p className={s.scoreBig}>{CLASSE_RISQUE_LABELS[retenu.classe]}</p>
          {a.moteur.eliminatoires.length ? (
            <p className={s.errorText}>Critère éliminatoire : {a.moteur.eliminatoires.join(' ; ')}</p>
          ) : (
            <p style={{ margin: 0 }}>Aucun critère éliminatoire.</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {PILIERS_SCORE.map((p) => {
          const m = a.moteur.piliers.find((x) => x.pilier === p)!;
          const aj = a.ajustements.find((x) => x.pilier === p);
          return (
            <div key={p} className={s.gaugeRow} style={{ gridTemplateColumns: 'minmax(140px,1.2fr) minmax(0,2fr) 90px' }}>
              <span title={m.details.join('\n')}>
                {PILIER_SCORE_LABELS[p]}
                <span className={s.hint}> · moteur {m.score}{aj ? ` · IA ${aj.delta > 0 ? '+' : ''}${aj.delta}` : ''}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={notes[p] ?? m.score}
                disabled={!actif}
                aria-label={`Note retenue : ${PILIER_SCORE_LABELS[p]}`}
                onChange={(e) => setNotes((n) => ({ ...n, [p]: Number(e.target.value) }))}
              />
              <span className={s.gaugeValue}>{notes[p] ?? m.score}</span>
            </div>
          );
        })}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary className={s.hint} style={{ cursor: 'pointer' }}>Détail du calcul du moteur</summary>
        <PiliersBars score={a.moteur} />
        <ul className={s.bullets}>
          {a.moteur.piliers.flatMap((p) => p.details.map((x) => <li key={p.pilier + x}>{p.label} — {x}</li>))}
        </ul>
      </details>

      {actif ? (
        <div className={s.stack} style={{ gap: 10, marginTop: 14 }}>
          {ecart ? (
            <div className={s.field}>
              <label className={s.label} htmlFor="sc-com">
                Justification de l’écart avec la proposition IA (obligatoire)
              </label>
              <textarea id="sc-com" className={s.textarea} rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </div>
          ) : null}
          {erreur ? <p className={s.errorText}>{erreur}</p> : null}
          <div>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy || (ecart && !commentaire.trim())} onClick={() => void valider()}>
              {busy ? 'Validation…' : `Valider le score ${retenu.total}/100`}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Rapport d'analyse ──────────────────────────────────────

export function RapportEditor({ d, actif }: { d: DossierPoste; actif: boolean }) {
  const { brouillon, maj, toast } = useBrouillon();
  const enregistre = normalizeRapportAnalyse(d.formulaires?.RAPPORT_ANALYSE);
  const [r, setR] = useState<RapportAnalyseData>(enregistre);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modifie, setModifie] = useState(false);
  const [deIa, setDeIa] = useState(false);

  useEffect(() => {
    if (brouillon.rapport) {
      setR((x) => ({ ...x, ...brouillon.rapport }));
      setModifie(true);
      setDeIa(true);
      maj({ rapport: null });
    }
  }, [brouillon.rapport, maj]);

  const set = (k: keyof RapportAnalyseData, v: string) => {
    setR((x) => ({ ...x, [k]: v }));
    setModifie(true);
  };
  const manquants = rapportAnalyseManquants(r);

  const enregistrer = async () => {
    setBusy(true);
    setErreur(null);
    try {
      await enregistrerFormulaire(d.id, 'RAPPORT_ANALYSE', r);
      setModifie(false);
      toast('Rapport d’analyse enregistré');
      await rafraichir(`/instruction/dossiers/${d.id}`);
    } catch (e) {
      setErreur(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const champ = (k: keyof RapportAnalyseData, label: string, rows = 4) => (
    <div className={s.field}>
      <label className={s.label} htmlFor={`ra-${k}`}>{label}</label>
      <textarea
        id={`ra-${k}`}
        className={`${s.textarea} ${deIa ? s.fieldIa : ''}`}
        rows={rows}
        value={r[k] as string}
        onChange={(e) => set(k, e.target.value)}
        disabled={!actif}
      />
    </div>
  );

  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>Rapport d’analyse</h3>
          <p className={s.cardSub}>
            {deIa ? '✦ Brouillon repris du copilote : relisez et ajustez avant d’enregistrer.' : 'Reprenez le brouillon du copilote ou rédigez directement.'}
          </p>
        </div>
        {manquants.length ? <span className={`${s.chip} ${s.chipAmber}`}>À compléter : {manquants.join(', ')}</span> : <span className={`${s.chip} ${s.chipGreen}`}>✓ Complet</span>}
      </div>
      <div className={s.stack} style={{ gap: 12 }}>
        {champ('synthese', 'Synthèse', 4)}
        {champ('analyseFinanciere', 'Analyse financière', 4)}
        {champ('coherenceTerrain', 'Cohérence terrain (CF1 / CF2 / checklist / rapport agent)', 3)}
        {champ('analyseRisques', 'Risques et mitigations', 3)}
        <div className={s.grid3}>
          <div className={s.field}>
            <label className={s.label} htmlFor="ra-reco">Recommandation</label>
            <select id="ra-reco" className={s.select} value={r.recommandation} onChange={(e) => set('recommandation', e.target.value)} disabled={!actif}>
              <option value="">—</option>
              <option value="ACCORD">Accord</option>
              <option value="ACCORD_CONDITIONNEL">Accord conditionnel</option>
              <option value="REFUS">Refus</option>
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="ra-montant">Montant proposé</label>
            <input id="ra-montant" className={s.input} inputMode="decimal" value={r.montantPropose} onChange={(e) => set('montantPropose', e.target.value)} disabled={!actif || r.recommandation === 'REFUS'} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="ra-duree">Durée (mois)</label>
            <input id="ra-duree" className={s.input} inputMode="numeric" value={r.dureeMois} onChange={(e) => set('dureeMois', e.target.value)} disabled={!actif || r.recommandation === 'REFUS'} />
          </div>
        </div>
        {champ('conditions', 'Conditions (une par ligne)', 3)}
        {erreur ? <p className={s.errorText}>{erreur}</p> : null}
        {actif ? (
          <div>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !modifie} onClick={() => void enregistrer()}>
              {busy ? 'Enregistrement…' : modifie ? 'Enregistrer le rapport' : 'Rapport enregistré'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── Avis de conformité ─────────────────────────────────────

export function AvisConformiteEditor({ d, actif }: { d: DossierPoste; actif: boolean }) {
  const { brouillon, maj, toast } = useBrouillon();
  const [a, setA] = useState<AvisConformiteData>(normalizeAvisConformite(d.formulaires?.AVIS_CONFORMITE));
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modifie, setModifie] = useState(false);
  const { avis } = useAvis(d.id, 'CONFORMITE');

  useEffect(() => {
    if (brouillon.constats) {
      setA((x) => ({ ...x, constats: brouillon.constats!, avisIaId: avis?.id ?? x.avisIaId }));
      setModifie(true);
      maj({ constats: null });
    }
  }, [brouillon.constats, maj, avis?.id]);

  const ouverts = a.constats.filter((c) => c.statut === 'NON_CONFORME').length;
  const enregistrer = async () => {
    setBusy(true);
    setErreur(null);
    try {
      await enregistrerFormulaire(d.id, 'AVIS_CONFORMITE', a);
      setModifie(false);
      toast('Avis de conformité enregistré');
      await rafraichir(`/instruction/dossiers/${d.id}`);
    } catch (e) {
      setErreur(msg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>Avis de conformité</h3>
          <p className={s.cardSub}>Reprenez les constats du copilote, levez ou confirmez chacun, puis concluez.</p>
        </div>
        {ouverts ? <span className={`${s.chip} ${s.chipRed}`}>{ouverts} non conforme(s)</span> : null}
      </div>
      <div className={s.stack} style={{ gap: 10 }}>
        {a.constats.map((c, i) => (
          <div key={c.id} className={s.item} style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
            <div className={s.grid2} style={{ alignItems: 'start' }}>
              <div>
                <p className={s.itemText}><strong>{c.exigence}</strong></p>
                {c.references ? <p className={s.itemFix}>📖 {c.references}</p> : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className={s.select}
                  aria-label={`Statut : ${c.exigence}`}
                  value={c.statut}
                  disabled={!actif}
                  onChange={(e) => {
                    const statut = e.target.value as (typeof STATUTS_CONSTAT)[number];
                    setA((x) => ({ ...x, constats: x.constats.map((y, j) => (j === i ? { ...y, statut } : y)) }));
                    setModifie(true);
                  }}
                >
                  {STATUTS_CONSTAT.map((st) => (
                    <option key={st} value={st}>{STATUT_CONSTAT_LABELS[st]}</option>
                  ))}
                </select>
              </div>
            </div>
            <input
              className={s.input}
              placeholder="Commentaire / justification"
              value={c.commentaire}
              disabled={!actif}
              onChange={(e) => {
                const v = e.target.value;
                setA((x) => ({ ...x, constats: x.constats.map((y, j) => (j === i ? { ...y, commentaire: v } : y)) }));
                setModifie(true);
              }}
            />
          </div>
        ))}
        {!a.constats.length ? <p className={s.hint}>Aucun constat repris. Utilisez « Reprendre les constats » dans le copilote.</p> : null}
        <div className={s.grid2}>
          <div className={s.field}>
            <label className={s.label} htmlFor="ac-dec">Conclusion</label>
            <select
              id="ac-dec"
              className={s.select}
              value={a.decision}
              disabled={!actif}
              onChange={(e) => {
                setA((x) => ({ ...x, decision: e.target.value as AvisConformiteData['decision'] }));
                setModifie(true);
              }}
            >
              <option value="">—</option>
              <option value="CONFORME">Conforme</option>
              <option value="NON_CONFORME">Non conforme</option>
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="ac-com">Commentaire</label>
            <input id="ac-com" className={s.input} value={a.commentaire} disabled={!actif} onChange={(e) => { setA((x) => ({ ...x, commentaire: e.target.value })); setModifie(true); }} />
          </div>
        </div>
        {a.decision === 'CONFORME' && ouverts ? (
          <p className={s.errorText}>Des constats sont encore « non conformes » : levez-les ou renvoyez le dossier à l’analyste.</p>
        ) : null}
        {erreur ? <p className={s.errorText}>{erreur}</p> : null}
        {actif ? (
          <div>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !modifie} onClick={() => void enregistrer()}>
              {busy ? 'Enregistrement…' : modifie ? 'Enregistrer l’avis' : 'Avis enregistré'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── PV (direction) / mémo PCA (Conseil) ────────────────────

export function PvPanel({ d, code }: { d: DossierPoste; code: 'DECISION_COMITE' | 'APPRO_PCA' }) {
  const { brouillon, maj } = useBrouillon();
  const f = (d.formulaires?.[code] ?? {}) as Record<string, any>;
  const pv = brouillon.pv ?? {
    montant: f.montantApprouve ?? '',
    dureeMois: f.dureeMois ?? '',
    observations: (code === 'APPRO_PCA' ? f.observationsCa : f.observations) ?? '',
  };
  useEffect(() => {
    if (!brouillon.pv) maj({ pv });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: 'montant' | 'dureeMois' | 'observations', v: string) => maj({ pv: { ...pv, [k]: v } });
  const devise = (d.payload as Record<string, any>)?.pret?.devise ?? (d.payload as Record<string, any>)?.devise ?? '';
  const montantUsd = d.seuil.montantUsd;
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>{code === 'APPRO_PCA' ? 'Mémo d’approbation du Conseil' : 'Conditions à porter au PV du comité'}</h3>
          <p className={s.cardSub}>Pré-remplissez avec la note du copilote ; le document complet reste dans l’onglet Fiches.</p>
        </div>
        {montantUsd != null && code === 'DECISION_COMITE' ? (
          <span className={`${s.chip} ${Number(pv.montant || 0) > d.seuil.seuilConseilUsd ? s.chipAmber : s.chipGreen}`}>
            seuil Conseil {money(d.seuil.seuilConseilUsd)} $
          </span>
        ) : null}
      </div>
      <div className={s.grid3}>
        <div className={s.field}>
          <label className={s.label} htmlFor="pv-m">Montant approuvé {devise ? `(${devise})` : ''}</label>
          <input id="pv-m" className={s.input} inputMode="decimal" value={pv.montant} onChange={(e) => set('montant', e.target.value)} />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="pv-d">Durée (mois)</label>
          <input id="pv-d" className={s.input} inputMode="numeric" value={pv.dureeMois} onChange={(e) => set('dureeMois', e.target.value)} />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="pv-o">Observations</label>
          <input id="pv-o" className={s.input} value={pv.observations} onChange={(e) => set('observations', e.target.value)} />
        </div>
      </div>
    </section>
  );
}

/** Enregistre le PV / mémo avec la décision, juste avant la transition. */
export async function enregistrerPv(
  d: DossierPoste,
  code: 'DECISION_COMITE' | 'APPRO_PCA',
  pv: { montant: string; dureeMois: string; observations: string },
  decision: 'APPROUVE' | 'REJETE',
  motif: string,
) {
  const f = (d.formulaires?.[code] ?? {}) as Record<string, any>;
  const data =
    code === 'DECISION_COMITE'
      ? {
          ...f,
          decision,
          montantApprouve: decision === 'APPROUVE' ? pv.montant : f.montantApprouve ?? '',
          dureeMois: decision === 'APPROUVE' ? pv.dureeMois : f.dureeMois ?? '',
          observations: pv.observations,
          raisonsRejetReport: decision === 'REJETE' ? motif : f.raisonsRejetReport ?? '',
          dateComite: f.dateComite || new Date().toISOString().slice(0, 10),
        }
      : {
          ...f,
          decision,
          montantApprouve: decision === 'APPROUVE' ? pv.montant : f.montantApprouve ?? '',
          dureeMois: decision === 'APPROUVE' ? pv.dureeMois : f.dureeMois ?? '',
          observationsCa: decision === 'REJETE' ? motif : pv.observations,
        };
  await enregistrerFormulaire(d.id, code, data);
}
