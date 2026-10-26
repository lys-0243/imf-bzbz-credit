'use client';

import {
  PRE_COMITE_AVIS_LABELS,
  PRE_COMITE_VERIFICATIONS,
  type PreComiteData,
} from '@imf/shared';
import {
  FormBlock,
  FormRow,
  OUI_NON_OPTIONS,
  SelectInput,
  TextArea,
  TextInput,
  optionsFromLabels,
} from '../FormKit';
import type { FicheProps } from './types';

const AUTRES: Array<[keyof PreComiteData['autres'], string]> = [
  ['typeActivite', 'Type d’activité'],
  ['ventesJournalieresDeclarees', 'Ventes journalières déclarées par le client'],
  ['dettes', 'Dette CT / MT / LT'],
  ['stockEstime', 'Stock estimé au vu du contrôle effectué'],
  ['dernierApprovisionnement', 'Dernier approvisionnement (montant, lieu et date)'],
  ['montantSouhaite', 'Montant souhaité par le client'],
  ['mensualiteSouhaitee', 'Mensualité souhaitée par le client'],
  ['objetCredit', 'Objet du crédit demandé'],
];

export function PreComiteFiche({ value, onChange, disabled }: FicheProps<PreComiteData>) {
  const groupes = [...new Set(PRE_COMITE_VERIFICATIONS.map((v) => v.groupe))];
  return (
    <>
      <FormBlock title="Visite">
        <FormRow label="Date de la visite">
          <TextInput type="date" value={value.dateVisite} disabled={disabled} onChange={(dateVisite) => onChange({ ...value, dateVisite })} />
        </FormRow>
        <FormRow label="Heure">
          <TextInput type="time" value={value.heureVisite} disabled={disabled} onChange={(heureVisite) => onChange({ ...value, heureVisite })} />
        </FormRow>
      </FormBlock>

      {groupes.map((g) => (
        <FormBlock key={g} title={`Vérification — ${g}`}>
          {PRE_COMITE_VERIFICATIONS.filter((v) => v.groupe === g).map((v) => (
            <FormRow key={v.key} label={v.label}>
              <SelectInput
                value={value.verifications[v.key]}
                options={OUI_NON_OPTIONS}
                disabled={disabled}
                onChange={(x) => onChange({ ...value, verifications: { ...value.verifications, [v.key]: x } })}
              />
            </FormRow>
          ))}
        </FormBlock>
      ))}

      <FormBlock title="Autres informations collectées">
        {AUTRES.map(([k, label]) => (
          <FormRow key={k} label={label}>
            <TextInput value={value.autres[k]} disabled={disabled} onChange={(x) => onChange({ ...value, autres: { ...value.autres, [k]: x } })} />
          </FormRow>
        ))}
      </FormBlock>

      <FormBlock title="Commentaires et décision">
        <FormRow label="Commentaires (incohérences relevées)">
          <TextArea rows={5} value={value.commentaires} disabled={disabled} onChange={(commentaires) => onChange({ ...value, commentaires })} />
        </FormRow>
        <FormRow label="Avis">
          <SelectInput value={value.avis} options={optionsFromLabels(PRE_COMITE_AVIS_LABELS)} disabled={disabled} onChange={(avis) => onChange({ ...value, avis })} />
        </FormRow>
        <FormRow label="Montant approuvé">
          <TextInput type="number" value={value.montantApprouve} disabled={disabled} onChange={(montantApprouve) => onChange({ ...value, montantApprouve })} />
        </FormRow>
        <FormRow label="Durée approuvée (mois)">
          <TextInput type="number" value={value.dureeApprouveeMois} disabled={disabled} onChange={(dureeApprouveeMois) => onChange({ ...value, dureeApprouveeMois })} />
        </FormRow>
        <FormRow label="Personne en charge de la visite">
          <TextInput value={value.visiteur} disabled={disabled} onChange={(visiteur) => onChange({ ...value, visiteur })} />
        </FormRow>
        <FormRow label="Fonction">
          <TextInput value={value.fonction} disabled={disabled} onChange={(fonction) => onChange({ ...value, fonction })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
