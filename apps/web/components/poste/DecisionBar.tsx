'use client';

import { useEffect, useMemo, useState } from 'react';
import { DOSSIER_ETAT_LABELS, PRONOSTIC_RECOMMANDATION_LABELS, type PronosticRecommandation } from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { money, rafraichir, type ActionDecision, type DossierPoste } from '../../lib/poste';
import { useBrouillon } from './brouillon';
import { enregistrerPv } from './Travail';
import s from './poste.module.css';

const IRREVERSIBLE = new Set(['A_DECAISSER', 'CONSEIL', 'REJETE']);

export function DecisionBar({ d, onFait }: { d: DossierPoste; onFait: (etat: string) => void }) {
  const { brouillon, maj, reinitialiser, toast } = useBrouillon();
  const [choix, setChoix] = useState<ActionDecision | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const avances = d.actions.filter((a) => a.nature === 'avance');
  const retours = d.actions.filter((a) => a.nature === 'retour');
  const rejets = d.actions.filter((a) => a.nature === 'rejet');

  // Le copilote peut pré-sélectionner une action (ex. « Préparer le renvoi »).
  useEffect(() => {
    if (!brouillon.action) return;
    const a = d.actions.find((x) => x.toEtat === brouillon.action);
    if (a) setChoix(a);
    maj({ action: null });
  }, [brouillon.action, d.actions, maj]);

  useEffect(() => {
    setConfirmer(false);
    setErreur(null);
  }, [choix]);

  const decisionRc = d.etat === 'EN_ATTENTE_VALIDATION_RC' && choix?.toEtat === 'DIRECTION';
  const pvCode = d.etat === 'DIRECTION' ? 'DECISION_COMITE' : d.etat === 'CONSEIL' ? 'APPRO_PCA' : null;
  const approbationInstance = pvCode != null && choix?.toEtat === 'A_DECAISSER';
  const rapport = d.formulaires?.RAPPORT_ANALYSE as { recommandation?: string; montantPropose?: string; dureeMois?: string } | undefined;
  const dec = brouillon.decision ?? {
    recommandation: ((rapport?.recommandation || 'ACCORD') as PronosticRecommandation),
    montant: rapport?.montantPropose ?? '',
    dureeMois: rapport?.dureeMois ?? '',
  };
  const devise = useMemo(() => {
    const p = (d.payload ?? {}) as Record<string, any>;
    return p.pret?.devise ?? p.devise ?? '';
  }, [d.payload]);

  if (!d.actions.length) return null;

  const valider = async () => {
    if (!choix) return;
    if (choix.motifRequis && !brouillon.motif.trim()) {
      setErreur('Indiquez le motif : il sera transmis au destinataire.');
      return;
    }
    if (IRREVERSIBLE.has(choix.toEtat) && !confirmer) {
      setConfirmer(true);
      return;
    }
    setBusy(true);
    setErreur(null);
    try {
      if (approbationInstance && pvCode) {
        const pv = brouillon.pv;
        if (!pv || !(Number(pv.montant) > 0) || !(Number(pv.dureeMois) > 0)) {
          throw new Error('Renseignez le montant et la durée approuvés.');
        }
        await enregistrerPv(d, pvCode, pv, 'APPROUVE', brouillon.motif);
      }
      if (pvCode && choix.toEtat === 'REJETE' && brouillon.pv) {
        await enregistrerPv(d, pvCode, brouillon.pv, 'REJETE', brouillon.motif);
      }
      const res = await apiFetch<{ etat: string }>(`/workflow/dossiers/${d.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toEtat: choix.toEtat,
          motif: brouillon.motif.trim() || undefined,
          details: brouillon.details.length ? brouillon.details : undefined,
          decision: decisionRc
            ? {
                recommandation: dec.recommandation,
                montantRetenu: dec.recommandation === 'REFUS' ? undefined : Number(dec.montant) || undefined,
                dureeRetenueMois: dec.recommandation === 'REFUS' ? undefined : Math.round(Number(dec.dureeMois)) || undefined,
              }
            : undefined,
        }),
      });
      toast(`Dossier ${d.reference} : ${DOSSIER_ETAT_LABELS[res.etat as keyof typeof DOSSIER_ETAT_LABELS] ?? res.etat}`);
      reinitialiser();
      setChoix(null);
      await Promise.all([rafraichir('/workflow/'), rafraichir(`/instruction/dossiers/${d.id}`)]);
      onFait(res.etat);
    } catch (e) {
      setErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Action impossible');
      setConfirmer(false);
    } finally {
      setBusy(false);
    }
  };

  const libelleAction = (a: ActionDecision) =>
    a.toEtat === 'A_DECAISSER' && d.etat === 'DIRECTION' ? 'Approuver le crédit' : a.label;

  return (
    <div className={s.decisionBar} role="region" aria-label="Décision">
      {choix ? (
        <div className={s.decisionPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <strong>{libelleAction(choix)}</strong>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setChoix(null)}>
              Annuler
            </button>
          </div>

          {decisionRc ? (
            <div className={s.grid3}>
              <div className={s.field}>
                <label className={s.label} htmlFor="dec-reco">Décision</label>
                <select
                  id="dec-reco"
                  className={s.select}
                  value={dec.recommandation}
                  onChange={(e) => maj({ decision: { ...dec, recommandation: e.target.value as PronosticRecommandation } })}
                >
                  {(['ACCORD', 'ACCORD_CONDITIONNEL', 'REFUS'] as const).map((r) => (
                    <option key={r} value={r}>{PRONOSTIC_RECOMMANDATION_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="dec-m">Montant retenu {devise ? `(${devise})` : ''}</label>
                <input id="dec-m" className={s.input} inputMode="decimal" value={dec.montant} onChange={(e) => maj({ decision: { ...dec, montant: e.target.value } })} />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="dec-d">Durée (mois)</label>
                <input id="dec-d" className={s.input} inputMode="numeric" value={dec.dureeMois} onChange={(e) => maj({ decision: { ...dec, dureeMois: e.target.value } })} />
              </div>
            </div>
          ) : null}

          {approbationInstance && brouillon.pv ? (
            <p className={s.hint} style={{ margin: 0 }}>
              Conditions approuvées : <strong>{money(brouillon.pv.montant, devise)}</strong> sur {brouillon.pv.dureeMois || '—'} mois
              {d.etat === 'DIRECTION'
                ? Number(brouillon.pv.montant) > d.seuil.seuilConseilUsd
                  ? ' — au-delà du seuil : le dossier ira au Conseil d’administration.'
                  : ' — sous le seuil : la demande sera clôturée et envoyée au core banking.'
                : ' — la demande sera clôturée et envoyée au core banking.'}
            </p>
          ) : null}

          {brouillon.details.length ? (
            <p className={s.hint} style={{ margin: 0 }}>
              {brouillon.details.length} point(s) joint(s) :{' '}
              {brouillon.details.map((p) => p.constat).slice(0, 3).join(' · ')}
              {brouillon.details.length > 3 ? '…' : ''}{' '}
              <button type="button" className={s.linkBtn} onClick={() => maj({ details: [] })}>
                retirer
              </button>
            </p>
          ) : null}

          <div className={s.field}>
            <label className={s.label} htmlFor="dec-motif">
              {choix.motifRequis ? 'Motif (obligatoire, transmis au destinataire)' : 'Commentaire (obligatoire si vous vous écartez de l’avis IA)'}
            </label>
            <textarea
              id="dec-motif"
              className={s.textarea}
              rows={2}
              value={brouillon.motif}
              onChange={(e) => maj({ motif: e.target.value })}
            />
          </div>
          {erreur ? <p className={s.errorText}>{erreur}</p> : null}
        </div>
      ) : null}

      <div className={s.decisionInner}>
        <div className={s.decisionInfo}>
          {choix ? (
            confirmer ? (
              <strong>Confirmez : cette décision est définitive pour cette étape.</strong>
            ) : (
              <>Vérifiez les éléments ci-dessus puis validez.</>
            )
          ) : (
            <>
              Étape : <strong>{DOSSIER_ETAT_LABELS[d.etat]}</strong> · {d.actions.length} action(s) possible(s)
            </>
          )}
        </div>
        {choix ? (
          <button
            type="button"
            className={`${s.btn} ${choix.nature === 'avance' ? s.btnPrimary : s.btnDanger}`}
            disabled={busy}
            onClick={() => void valider()}
          >
            {busy ? 'Envoi…' : confirmer ? `Confirmer : ${libelleAction(choix)}` : `Valider : ${libelleAction(choix)}`}
          </button>
        ) : (
          <>
            {rejets.map((a) => (
              <button key={a.toEtat} type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => setChoix(a)}>
                {a.label}
              </button>
            ))}
            {retours.length === 1 ? (
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => setChoix(retours[0])}>
                ↺ {retours[0].label}
              </button>
            ) : retours.length > 1 ? (
              <select
                className={s.select}
                style={{ width: 'auto' }}
                aria-label="Renvoyer le dossier"
                value=""
                onChange={(e) => setChoix(retours.find((r) => r.toEtat === e.target.value) ?? null)}
              >
                <option value="">↺ Renvoyer…</option>
                {retours.map((r) => (
                  <option key={r.toEtat} value={r.toEtat}>{r.label}</option>
                ))}
              </select>
            ) : null}
            {avances.map((a) => (
              <button key={a.toEtat} type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setChoix(a)}>
                {libelleAction(a)}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
