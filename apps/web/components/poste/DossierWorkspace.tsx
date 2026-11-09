'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import type { AvisAnalyse, AvisConformiteIa, AvisSynthese, ControleDossier, TypeAvisIa } from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dateHeure, rafraichir, useDossier, useFile, type AvisIa, type DossierPoste } from '../../lib/poste';
import { DossierDetailView } from '../dashboard/DossierDetailView';
import { PageError, PageStateBlock } from '../dashboard/PageState';
import { BrouillonProvider, useBrouillon } from './brouillon';
import { AvisCard, VueAnalyse, VueConformite, VueControle, VueSynthese } from './Copilote';
import { DecisionBar } from './DecisionBar';
import { ParcoursChronologie, PointsRetour } from './ParcoursChronologie';
import { ParcoursStepper } from './ParcoursStepper';
import { SyntheseDecision } from './SyntheseDecision';
import { AttributionPanel, AvisConformiteEditor, PvPanel, RapportEditor, ScorePanel } from './Travail';
import s from './poste.module.css';

/** Avis IA de l'étape courante et rôles qui peuvent le (re)générer. */
function avisEtape(etat: string): { type: TypeAvisIa; generateurs: string[] } | null {
  switch (etat) {
    case 'EN_ATTENTE_ATTRIBUTION_AGENT':
      return { type: 'SUGGESTION_AGENTS', generateurs: ['RESPONSABLE_CREDIT', 'ADMIN'] };
    case 'ANALYSTE':
    case 'RETOUR_ANALYSTE':
      return { type: 'ANALYSE', generateurs: ['ANALYSTE', 'ADMIN'] };
    case 'CONFORMITE':
      return { type: 'CONFORMITE', generateurs: ['CONFORMITE', 'ADMIN'] };
    case 'EN_ATTENTE_VALIDATION_RC':
      return { type: 'SYNTHESE_RC', generateurs: ['RESPONSABLE_CREDIT', 'ADMIN'] };
    case 'DIRECTION':
      return { type: 'SYNTHESE_DIRECTION', generateurs: ['DG', 'DGA', 'ADMIN'] };
    case 'CONSEIL':
      return { type: 'SYNTHESE_CONSEIL', generateurs: ['CA', 'ADMIN'] };
    case 'A_DECAISSER':
    case 'REJETE':
      return { type: 'SYNTHESE_DIRECTION', generateurs: [] };
    default:
      // Chez l'agent : la dernière contre-vérification, s'il y en a une.
      return { type: 'ANALYSE', generateurs: [] };
  }
}

function CopiloteEtape({ d, role }: { d: DossierPoste; role: string }) {
  const cfg = avisEtape(d.etat)!;
  const actif = d.actions.length > 0 || (d.etat === 'EN_ATTENTE_ATTRIBUTION_AGENT' && role === 'RESPONSABLE_CREDIT');
  const peutGenerer = actif && cfg.generateurs.includes(role);
  return (
    <AvisCard dossierId={d.id} type={cfg.type} peutGenerer={peutGenerer}>
      {(avis: AvisIa<any>) => {
        switch (cfg.type) {
          case 'SUGGESTION_AGENTS':
            return (
              <>
                <p style={{ margin: 0 }}>{avis.contenu.synthese}</p>
                <ol className={s.bullets}>
                  {avis.contenu.candidats.slice(0, 5).map((c: { agentId: string; displayName: string; justification: string }) => (
                    <li key={c.agentId}>
                      <strong>{c.displayName}</strong> — {c.justification}
                    </li>
                  ))}
                </ol>
              </>
            );
          case 'ANALYSE':
            return <VueAnalyse avis={avis as AvisIa<AvisAnalyse>} actif={actif && ['ANALYSTE', 'RETOUR_ANALYSTE'].includes(d.etat)} />;
          case 'CONFORMITE':
            return <VueConformite avis={avis as AvisIa<AvisConformiteIa>} actif={actif} />;
          default:
            return (
              <VueSynthese
                avis={avis as AvisIa<AvisSynthese>}
                actif={actif}
                cible={cfg.type === 'SYNTHESE_RC' ? 'decision' : 'pv'}
              />
            );
        }
      }}
    </AvisCard>
  );
}

/** Pré-contrôle IA pour l'agent (avant soumission) — réutilisé par l'espace agent. */
export function PrecontroleAgent({ dossierId }: { dossierId: string }) {
  return (
    <BrouillonProvider>
      <AvisCard dossierId={dossierId} type="PRECONTROLE" peutGenerer titre="Pré-contrôle IA avant soumission">
        {(avis: AvisIa<ControleDossier>) => <VueControle c={avis.contenu!} selectionnable={false} />}
      </AvisCard>
    </BrouillonProvider>
  );
}

function Travail({ d, role, onFait }: { d: DossierPoste; role: string; onFait: () => void }) {
  const actif = d.actions.length > 0;
  const dernierRetour = [...d.transitions].reverse().find((t) => t.nature === 'retour');
  const bandeauRetour =
    dernierRetour && ['RETOUR_ANALYSTE', 'EN_ATTENTE_VALIDATION_RC', 'CONFORMITE'].includes(d.etat) && dernierRetour.toEtat === d.etat ? (
      <section className={s.card} style={{ borderColor: 'var(--imf-red)' }}>
        <h3 className={s.cardTitle}>↺ Dossier renvoyé par {dernierRetour.acteur?.displayName ?? '—'}</h3>
        <p className={s.cardSub}>{dateHeure(dernierRetour.createdAt)}</p>
        {dernierRetour.comment ? <p className={s.itemText} style={{ marginTop: 8 }}>{dernierRetour.comment}</p> : null}
        <PointsRetour details={dernierRetour.details} />
      </section>
    ) : null;

  let contenu: ReactNode = null;
  if (d.etat === 'EN_ATTENTE_ATTRIBUTION_AGENT' && (role === 'RESPONSABLE_CREDIT' || role === 'ADMIN')) {
    contenu = <AttributionPanel d={d} onFait={onFait} />;
  } else if (d.etat === 'ANALYSTE' || d.etat === 'RETOUR_ANALYSTE') {
    contenu = (
      <>
        <ScorePanel d={d} actif={actif} />
        <RapportEditor d={d} actif={actif} />
      </>
    );
  } else if (d.etat === 'CONFORMITE') {
    contenu = <AvisConformiteEditor d={d} actif={actif} />;
  } else if (d.etat === 'DIRECTION' && actif) {
    contenu = <PvPanel d={d} code="DECISION_COMITE" />;
  } else if (d.etat === 'CONSEIL' && actif) {
    contenu = <PvPanel d={d} code="APPRO_PCA" />;
  }
  if (d.etat === 'A_DECAISSER') {
    contenu = (
      <section className={s.card}>
        <h3 className={s.cardTitle}>Crédit accordé — demande clôturée</h3>
        <p className={s.cardSub}>Transmission au core banking</p>
        <p style={{ marginTop: 10 }}>
          {d.cbs ? (
            <span className={`${s.chip} ${d.cbs.statut === 'ENVOYE' ? s.chipGreen : d.cbs.statut === 'ECHEC' ? s.chipRed : s.chipAmber}`}>
              {d.cbs.statut === 'ENVOYE'
                ? `✓ Envoyé au CBS ${dateHeure(d.cbs.envoyeAt)}`
                : d.cbs.statut === 'ECHEC'
                  ? `✕ Échec : ${d.cbs.dernierMessage ?? ''}`
                  : `En file d’envoi (tentative ${d.cbs.tentatives})`}
            </span>
          ) : (
            <span className={s.hint}>Aucun envoi enregistré.</span>
          )}
        </p>
      </section>
    );
  }
  if (!contenu && !bandeauRetour) {
    contenu = (
      <section className={s.card}>
        <h3 className={s.cardTitle}>Aucune saisie à cette étape</h3>
        <p className={s.cardSub}>
          {actif ? 'Consultez la synthèse et l’avis du copilote, puis décidez avec la barre en bas de l’écran.' : 'Le dossier est entre les mains d’un autre intervenant.'}
        </p>
      </section>
    );
  }
  return (
    <div className={s.stack}>
      {bandeauRetour}
      {contenu}
    </div>
  );
}

function Toast() {
  const { message } = useBrouillon();
  return message ? (
    <div className={s.toast} role="status">
      {message}
    </div>
  ) : null;
}

function Workspace({ d, base, reload }: { d: DossierPoste; base: string; reload: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const file = useFile();
  const [copiloteOuvert, setCopiloteOuvert] = useState(false);
  const [prise, setPrise] = useState<string | null>(null);
  const role = user?.role ?? '';

  const suivant = useMemo(
    () => file.data?.dossiers.find((x) => x.aTraiter && x.id !== d.id) ?? null,
    [file.data, d.id],
  );
  const apresDecision = () => {
    if (suivant) router.push(`/${base}/${suivant.id}`);
    else router.push(`/${base}/file`);
  };

  const prendre = async () => {
    setPrise(null);
    try {
      await apiFetch(`/workflow/dossiers/${d.id}/prendre-en-charge`, { method: 'POST' });
      await Promise.all([reload(), rafraichir('/workflow/file')]);
    } catch (e) {
      setPrise(e instanceof ApiError ? e.message : 'Prise en charge impossible');
    }
  };

  const titulaire =
    d.etat === 'ANALYSTE' || d.etat === 'RETOUR_ANALYSTE'
      ? d.titulaires.analyste
      : d.etat === 'CONFORMITE'
        ? d.titulaires.conformite
        : null;

  const tabs = [
    { key: 'decision', label: '✦ Décision' },
    { key: 'synthese', label: 'Synthèse' },
    { key: 'parcours', label: 'Parcours' },
  ];

  return (
    <>
      <div className={s.workspace}>
        <div className={s.wsMain}>
          {d.peutPrendreEnCharge ? (
            <div className={s.iaReco} style={{ marginBottom: 12 }}>
              <span>
                Ce dossier est dans la <strong>file commune</strong>. Prenez-le en charge pour en devenir titulaire (il vous reviendra en cas de retour).
              </span>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`} onClick={() => void prendre()}>
                Prendre en charge
              </button>
            </div>
          ) : titulaire && titulaire.id !== user?.id ? (
            <p className={s.iaWarn} style={{ marginTop: 0 }}>
              Dossier pris en charge par {titulaire.displayName} : consultation seule.
            </p>
          ) : null}
          {prise ? <p className={s.errorText}>{prise}</p> : null}
          <DossierDetailView
            data={d}
            header={<ParcoursStepper d={d} />}
            leadingTabs={tabs}
            initialTab="decision"
            extraTabContent={{
              decision: <Travail d={d} role={role} onFait={apresDecision} />,
              synthese: <SyntheseDecision d={d} />,
              parcours: <ParcoursChronologie d={d} />,
            }}
            bottomInset={d.actions.length ? 76 : 0}
            sansBoutonsFlottants
            canManageDocs={false}
          />
        </div>
        <aside className={`${s.copilote} ${copiloteOuvert ? s.copiloteOpen : ''}`} aria-label="Copilote IA">
          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.copiloteClose}`} style={{ alignSelf: 'flex-end' }} onClick={() => setCopiloteOuvert(false)}>
            Fermer ✕
          </button>
          <CopiloteEtape d={d} role={role} />
        </aside>
        <button type="button" className={`${s.btn} ${s.btnIa} ${s.copiloteToggle}`} onClick={() => setCopiloteOuvert(true)}>
          ✦ Copilote
        </button>
      </div>
      <DecisionBar d={d} onFait={apresDecision} />
      <Toast />
    </>
  );
}

export function DossierWorkspace({ id, base }: { id: string; base: string }) {
  const { data, error, mutate } = useDossier(id);
  if (error && !data) {
    return (
      <PageStateBlock>
        <PageError title="Impossible de charger le dossier" message={error instanceof Error ? error.message : 'Erreur'} />
      </PageStateBlock>
    );
  }
  if (!data) {
    return (
      <div className={s.workspace}>
        <div className={s.stack}>
          <div className={s.skeleton} style={{ height: 80 }} />
          <div className={s.skeleton} style={{ height: 140 }} />
          <div className={s.skeleton} style={{ height: 360 }} />
        </div>
        <div className={s.skeleton} style={{ height: 420 }} />
      </div>
    );
  }
  return (
    <BrouillonProvider key={data.id}>
      <Workspace d={data} base={base} reload={() => void mutate()} />
    </BrouillonProvider>
  );
}
