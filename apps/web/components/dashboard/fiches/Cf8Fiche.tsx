'use client';

import type { CSSProperties } from 'react';
import {
  CF8_CONTROLES,
  CF8_EVOLUTION_LABELS,
  CF8_NOTE_EXPLICATION,
  identiteDemandeur,
  newCf8Visite,
  type Cf8Data,
  type Cf8Visite,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  SelectInput,
  TextArea,
  TextInput,
  optionsFromLabels,
} from '../FormKit';
import { patchAt, type FicheProps } from './types';

const NOTE: CSSProperties = { display: 'block', marginTop: 4, fontSize: '0.75rem', color: 'var(--imf-muted)' };

const OPT = <const T extends string>(...o: Array<[T, string]>) => [
  { value: '' as T, label: '—' },
  ...o.map(([value, label]) => ({ value, label })),
];

function LectureSeule({ valeur, note }: { valeur: string; note?: string }) {
  return (
    <>
      <TextInput value={valeur || '—'} disabled onChange={() => undefined} />
      {note ? <span style={NOTE}>{note}</span> : null}
    </>
  );
}

function VisiteForm({
  visite,
  index,
  disabled,
  agentNom,
  nomClient,
  nomGarant,
  onChange,
  onRemove,
}: {
  visite: Cf8Visite;
  index: number;
  disabled: boolean;
  agentNom: string;
  nomClient: string;
  nomGarant: string;
  onChange: (patch: Partial<Cf8Visite>) => void;
  onRemove: () => void;
}) {
  const ligne = (groupe: 'DOMICILE' | 'BUSINESS') =>
    CF8_CONTROLES.filter((c) => c.groupe === groupe).map((c) => (
      <FormRow key={c.key} label={c.label}>
        <SelectInput
          value={visite.controles[c.key]}
          options={OPT(['CONFORME', c.conforme], ['DIFFERENT', c.different], ['NON_VERIFIABLE', 'Pas possible de vérifier'])}
          disabled={disabled}
          onChange={(v) => onChange({ controles: { ...visite.controles, [c.key]: v } })}
        />
      </FormRow>
    ));

  // Explication attendue dès qu'une information diffère, n'est pas vérifiable ou qu'un risque apparaît.
  const aExpliquer =
    Object.values(visite.controles).some((v) => v === 'DIFFERENT' || v === 'NON_VERIFIABLE') ||
    visite.butInvesti === 'NON_PARTIEL' ||
    visite.emploi === 'CHANGE' ||
    visite.emploi === 'NON_VERIFIABLE' ||
    visite.nouveauxRisques === 'OUI';

  /** Signataire client/garant proposé selon la personne visitée. */
  const nomVisite = (cible: Cf8Visite['cible']) => (cible === 'CLIENT' ? nomClient : cible === 'GARANT' ? nomGarant : '');

  return (
    <>
      <FormBlock
        title={`Visite ${index + 1} — suivi et supervision`}
        actions={
          !disabled ? (
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onRemove}>
              Supprimer la visite
            </button>
          ) : undefined
        }
      >
        <FormRow label="Visite au">
          <SelectInput
            value={visite.cible}
            options={OPT(['CLIENT', 'Client'], ['GARANT', 'Garant'])}
            disabled={disabled}
            onChange={(cible) => {
              const auto = nomVisite(visite.cible);
              const sig = visite.signatures.clientGarant;
              // Préremplit le signataire, sans écraser une saisie manuelle.
              onChange({
                cible,
                signatures: { ...visite.signatures, clientGarant: !sig || sig === auto ? nomVisite(cible) : sig },
              });
            }}
          />
        </FormRow>
        <FormRow label="Agent de relation avec le client responsable">
          <LectureSeule valeur={agentNom} note="Agent attribué au dossier — non modifiable." />
        </FormRow>
        <FormRow label="Heure et date">
          <TextInput type="datetime-local" value={visite.dateHeure} disabled={disabled} onChange={(dateHeure) => onChange({ dateHeure })} />
        </FormRow>
        <FormRow label="Accompagné par">
          <SelectInput
            value={visite.accompagnePar}
            options={OPT(['PERSONNE', 'Personne'], ['SUPERVISEUR', 'Superviseur'], ['AUTRE', 'CA / CR / autre'])}
            disabled={disabled}
            onChange={(accompagnePar) => onChange({ accompagnePar })}
          />
        </FormRow>
        <FormRow label="Le prêt est">
          <SelectInput
            value={visite.statutPret}
            options={OPT(['AVANT_DEBOURSEMENT', 'En cours de traitement (avant déboursement)'], ['ENCOURS', 'Encours'])}
            disabled={disabled}
            onChange={(statutPret) => onChange({ statutPret })}
          />
        </FormRow>
        <FormRow label="Lieu de la visite">
          <SelectInput
            value={visite.lieu}
            options={OPT(['DOMICILE', 'Domicile'], ['BUSINESS', 'Business'], ['EMPLOI', 'Emploi'])}
            disabled={disabled}
            onChange={(lieu) => onChange({ lieu })}
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="1. Informations sur le domicile">{ligne('DOMICILE')}</FormBlock>

      <FormBlock title="2. Informations sur le business">
        {ligne('BUSINESS')}
        <FormRow label="But du prêt : investi comme convenu ?">
          <SelectInput
            value={visite.butInvesti}
            options={OPT(['OUI', 'Oui'], ['NON_PARTIEL', 'Non / partiellement'])}
            disabled={disabled}
            onChange={(butInvesti) => onChange({ butInvesti })}
          />
        </FormRow>
        <FormRow label="Évaluation de l’activité dans l’ensemble">
          <SelectInput
            value={visite.evolutionActivite}
            options={optionsFromLabels(CF8_EVOLUTION_LABELS)}
            disabled={disabled}
            onChange={(evolutionActivite) => onChange({ evolutionActivite })}
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="3. Informations sur l’emploi">
        <FormRow label="Situation de l’emploi">
          <SelectInput
            value={visite.emploi}
            options={OPT(['CONFORME', 'Comme évaluée'], ['CHANGE', 'A changé'], ['NON_VERIFIABLE', 'Pas possible de vérifier'])}
            disabled={disabled}
            onChange={(emploi) => onChange({ emploi })}
          />
        </FormRow>
      </FormBlock>

      <FormBlock title="4. Commentaires & explications">
        <FormRow label="Nouveaux problèmes, défis ou risques ?">
          <SelectInput
            value={visite.nouveauxRisques}
            options={OPT(['NON', 'Non'], ['OUI', 'Oui (expliquer ci-dessous)'])}
            disabled={disabled}
            onChange={(nouveauxRisques) => onChange({ nouveauxRisques })}
          />
        </FormRow>
        <FormRow label="Explications">
          <TextArea rows={4} value={visite.commentaires} disabled={disabled} onChange={(commentaires) => onChange({ commentaires })} />
          <span style={{ ...NOTE, color: aExpliquer && !visite.commentaires.trim() ? 'var(--imf-red)' : NOTE.color }}>
            {CF8_NOTE_EXPLICATION}
          </span>
        </FormRow>
      </FormBlock>

      <FormBlock title="Signatures">
        <FormRow label="Signature du client / garant">
          <TextInput
            value={visite.signatures.clientGarant}
            disabled={disabled}
            placeholder={visite.cible ? undefined : 'Choisissez d’abord « Visite au »'}
            onChange={(clientGarant) => onChange({ signatures: { ...visite.signatures, clientGarant } })}
          />
        </FormRow>
        <FormRow label="Signature de l’agent de crédit">
          <LectureSeule valeur={agentNom} note="Agent attribué au dossier — non modifiable." />
        </FormRow>
        <FormRow label="Signature du superviseur">
          <TextInput
            value={visite.signatures.superviseur}
            disabled={disabled}
            onChange={(superviseur) => onChange({ signatures: { ...visite.signatures, superviseur } })}
          />
        </FormRow>
      </FormBlock>
    </>
  );
}

export function Cf8Fiche({ value, onChange, disabled, ctx }: FicheProps<Cf8Data>) {
  const agentNom = ctx.agent?.displayName ?? '';
  const nomClient = identiteDemandeur(ctx.payload).nomComplet || ctx.client.fullName;
  const nomGarant = ctx.formulaires.CF4.identite.nomComplet;
  return (
    <>
      <FormBlock title="Suivi et supervision">
        <FormRow label="Nom du client">
          <LectureSeule valeur={nomClient} />
        </FormRow>
      </FormBlock>
      <div className={styles.cf2TableHeader}>
        <p className={styles.assignHint} style={{ margin: 0 }}>
          {value.visites.length} visite(s) de suivi enregistrée(s).
        </p>
        {!disabled ? (
          <AddRowButton
            label="Nouvelle visite"
            onClick={() => onChange({ visites: [...value.visites, newCf8Visite({ agent: agentNom })] })}
          />
        ) : null}
      </div>
      {value.visites.map((v, i) => (
        <VisiteForm
          key={v.id}
          visite={v}
          index={i}
          disabled={disabled}
          agentNom={agentNom || v.agent}
          nomClient={nomClient}
          nomGarant={nomGarant}
          onChange={(patch) => onChange({ visites: patchAt(value.visites, i, patch) })}
          onRemove={() => onChange({ visites: value.visites.filter((_, j) => j !== i) })}
        />
      ))}
    </>
  );
}
