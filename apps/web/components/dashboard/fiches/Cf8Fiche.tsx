'use client';

import {
  CF8_CONTROLES,
  CF8_CONTROLE_LABELS,
  CF8_EVOLUTION_LABELS,
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

const CONTROLE_OPTIONS = optionsFromLabels(CF8_CONTROLE_LABELS);

function VisiteForm({
  visite,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  visite: Cf8Visite;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<Cf8Visite>) => void;
  onRemove: () => void;
}) {
  const groupes = [...new Set(CF8_CONTROLES.map((c) => c.groupe))];
  return (
    <>
      <FormBlock
        title={`Visite ${index + 1}`}
        actions={
          !disabled ? (
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onRemove}>
              Supprimer la visite
            </button>
          ) : undefined
        }
      >
        <FormRow label="Date et heure">
          <TextInput type="datetime-local" value={visite.dateHeure} disabled={disabled} onChange={(dateHeure) => onChange({ dateHeure })} />
        </FormRow>
        <FormRow label="Visite au">
          <SelectInput value={visite.cible} options={[{ value: '', label: '—' }, { value: 'CLIENT', label: 'Client' }, { value: 'GARANT', label: 'Garant' }]} disabled={disabled} onChange={(cible) => onChange({ cible })} />
        </FormRow>
        <FormRow label="Agent responsable">
          <TextInput value={visite.agent} disabled={disabled} onChange={(agent) => onChange({ agent })} />
        </FormRow>
        <FormRow label="Accompagné par">
          <SelectInput value={visite.accompagnePar} options={[{ value: '', label: '—' }, { value: 'PERSONNE', label: 'Personne' }, { value: 'SUPERVISEUR', label: 'Superviseur' }, { value: 'AUTRE', label: 'CA / CR / autre' }]} disabled={disabled} onChange={(accompagnePar) => onChange({ accompagnePar })} />
        </FormRow>
        <FormRow label="Le prêt est">
          <SelectInput value={visite.statutPret} options={[{ value: '', label: '—' }, { value: 'AVANT_DEBOURSEMENT', label: 'En cours de traitement (avant déboursement)' }, { value: 'ENCOURS', label: 'Encours' }]} disabled={disabled} onChange={(statutPret) => onChange({ statutPret })} />
        </FormRow>
        <FormRow label="Lieu de la visite">
          <SelectInput value={visite.lieu} options={[{ value: '', label: '—' }, { value: 'DOMICILE', label: 'Domicile' }, { value: 'BUSINESS', label: 'Business' }, { value: 'EMPLOI', label: 'Emploi' }]} disabled={disabled} onChange={(lieu) => onChange({ lieu })} />
        </FormRow>
      </FormBlock>

      {groupes.map((g) => (
        <FormBlock key={g} title={`Informations — ${g}`}>
          {CF8_CONTROLES.filter((c) => c.groupe === g).map((c) => (
            <FormRow key={c.key} label={c.label}>
              <SelectInput value={visite.controles[c.key]} options={CONTROLE_OPTIONS} disabled={disabled} onChange={(v) => onChange({ controles: { ...visite.controles, [c.key]: v } })} />
            </FormRow>
          ))}
        </FormBlock>
      ))}

      <FormBlock title="Évaluation">
        <FormRow label="But du prêt : investi comme convenu ?">
          <SelectInput value={visite.butInvesti} options={[{ value: '', label: '—' }, { value: 'OUI', label: 'Oui' }, { value: 'NON_PARTIEL', label: 'Non / partiellement' }]} disabled={disabled} onChange={(butInvesti) => onChange({ butInvesti })} />
        </FormRow>
        <FormRow label="Évaluation de l’activité dans l’ensemble">
          <SelectInput value={visite.evolutionActivite} options={optionsFromLabels(CF8_EVOLUTION_LABELS)} disabled={disabled} onChange={(evolutionActivite) => onChange({ evolutionActivite })} />
        </FormRow>
        <FormRow label="Situation de l’emploi">
          <SelectInput value={visite.emploi} options={[{ value: '', label: '—' }, { value: 'CONFORME', label: 'Comme évaluée' }, { value: 'CHANGE', label: 'A changé' }, { value: 'NON_VERIFIABLE', label: 'Pas possible de vérifier' }]} disabled={disabled} onChange={(emploi) => onChange({ emploi })} />
        </FormRow>
        <FormRow label="Nouveaux problèmes, défis ou risques ?">
          <SelectInput value={visite.nouveauxRisques} options={[{ value: '', label: '—' }, { value: 'NON', label: 'Non' }, { value: 'OUI', label: 'Oui' }]} disabled={disabled} onChange={(nouveauxRisques) => onChange({ nouveauxRisques })} />
        </FormRow>
        <FormRow label="Commentaires & explications (si « différent » ou « pas possible de vérifier »)">
          <TextArea rows={4} value={visite.commentaires} disabled={disabled} onChange={(commentaires) => onChange({ commentaires })} />
        </FormRow>
      </FormBlock>
    </>
  );
}

export function Cf8Fiche({ value, onChange, disabled }: FicheProps<Cf8Data>) {
  return (
    <>
      <div className={styles.cf2TableHeader}>
        <p className={styles.assignHint} style={{ margin: 0 }}>
          {value.visites.length} visite(s) de suivi enregistrée(s).
        </p>
        {!disabled ? (
          <AddRowButton label="Nouvelle visite" onClick={() => onChange({ visites: [...value.visites, newCf8Visite()] })} />
        ) : null}
      </div>
      {value.visites.map((v, i) => (
        <VisiteForm
          key={v.id}
          visite={v}
          index={i}
          disabled={disabled}
          onChange={(patch) => onChange({ visites: patchAt(value.visites, i, patch) })}
          onRemove={() => onChange({ visites: value.visites.filter((_, j) => j !== i) })}
        />
      ))}
    </>
  );
}
