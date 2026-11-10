'use client';

import { CF4_TYPE_GARANT_LABELS, type Cf4Data } from '@imf/shared';
import {
  AmountField,
  FormBlock,
  FormRow,
  OUI_NON_OPTIONS,
  SelectInput,
  TextInput,
  optionsFromLabels,
} from '../FormKit';
import type { FicheProps } from './types';

type Section = 'identite' | 'business' | 'emploi' | 'certification';

/** Texte de certification signé par l’agent de crédit (affiché en tête du bloc). */
const TEXTE_CERTIFICATION =
  'Je certifie que les informations présentées sur ce formulaire sont telles qu’elles ont été recueillies au cours des visites. J’ai tout fait pour m’assurer de la véracité des informations reçues. Aucune information susceptible à influencer la dernière décision de cette demande n’a été omise intentionnellement.';

export function Cf4Fiche({ value, onChange, disabled, devise, ctx }: FicheProps<Cf4Data>) {
  /** Agent attribué au dossier — imposé (le serveur l’écrit aussi à l’enregistrement). */
  const agentNom = ctx.agent?.displayName || value.certification.agent || '';
  function set<S extends Section>(section: S, patch: Partial<Cf4Data[S]>) {
    onChange({ ...value, [section]: { ...value[section], ...patch } });
  }
  const text = <S extends Section>(section: S, key: keyof Cf4Data[S] & string, label: string, type?: 'text' | 'date') => (
    <FormRow label={label}>
      <TextInput
        type={type}
        value={String(value[section][key] ?? '')}
        disabled={disabled}
        onChange={(v) => set(section, { [key]: v } as Partial<Cf4Data[S]>)}
      />
    </FormRow>
  );

  return (
    <>
      <FormBlock title="1. Type de garant">
        <FormRow label="Type">
          <SelectInput
            value={value.typeGarant}
            options={optionsFromLabels(CF4_TYPE_GARANT_LABELS)}
            disabled={disabled}
            onChange={(typeGarant) => onChange({ ...value, typeGarant })}
          />
        </FormRow>
        {value.typeGarant === 'AUTRE' ? (
          <FormRow label="Préciser">
            <TextInput value={value.typeGarantAutre} disabled={disabled} onChange={(typeGarantAutre) => onChange({ ...value, typeGarantAutre })} />
          </FormRow>
        ) : null}
      </FormBlock>

      <FormBlock title="2. Information sur le garant">
        {text('identite', 'nomComplet', 'Nom complet')}
        <FormRow label="Sexe">
          <SelectInput
            value={value.identite.sexe}
            options={[{ value: '', label: '—' }, { value: 'M', label: 'M' }, { value: 'F', label: 'F' }]}
            disabled={disabled}
            onChange={(sexe) => set('identite', { sexe })}
          />
        </FormRow>
        {text('identite', 'dateNaissance', 'Date de naissance', 'date')}
        {text('identite', 'conjoint', 'Nom complet du/des conjoint(s)')}
        {text('identite', 'etatCivil', 'État civil')}
        {text('identite', 'adresseDomicile', 'Adresse du domicile')}
        {text('identite', 'telephone', 'Téléphone')}
        {text('identite', 'residenceDepuis', 'Résidence (depuis)')}
        {text('identite', 'relationDemandeur', 'Type de relation avec le demandeur')}
        {text('identite', 'personnesACharge', 'Nombre de personnes à charge')}
      </FormBlock>

      <FormBlock title="3. Information sur le business">
        {text('business', 'adresse', 'Adresse de l’activité')}
        {text('business', 'adresseDepuis', 'À cette adresse depuis')}
        {text('business', 'activite', 'Activité')}
        {text('business', 'activiteDepuis', 'Activité depuis')}
        <FormRow label="Locaux de l’activité (propriétaire)">
          <SelectInput value={value.business.locauxPropres} options={OUI_NON_OPTIONS} disabled={disabled} onChange={(locauxPropres) => set('business', { locauxPropres })} />
        </FormRow>
        {text('business', 'pointsDeVente', 'Nombre de points de vente')}
        <FormRow label="Co-propriétaires ?">
          <SelectInput value={value.business.coProprietaires} options={OUI_NON_OPTIONS} disabled={disabled} onChange={(coProprietaires) => set('business', { coProprietaires })} />
        </FormRow>
        {text('business', 'nombreAgents', 'Nombre d’agents')}
      </FormBlock>

      <FormBlock title="4. Information sur l’emploi">
        {text('emploi', 'employeur', 'Nom de l’employeur')}
        {text('emploi', 'secteur', 'Secteur')}
        {text('emploi', 'adresse', 'Adresse')}
        {text('emploi', 'telephone', 'Téléphone')}
        {text('emploi', 'personneRessource', 'Personne-ressource')}
        {text('emploi', 'postePersonneRessource', 'Poste de la personne-ressource')}
        {text('emploi', 'poste', 'Poste du garant')}
        {text('emploi', 'depuis', 'Depuis')}
        <FormRow label="Revenu mensuel net">
          <AmountField value={value.emploi.revenuMensuelNet} devise={devise} disabled={disabled} onChange={(revenuMensuelNet) => set('emploi', { revenuMensuelNet })} />
        </FormRow>
        <FormRow label="En période d’essai ?">
          <SelectInput value={value.emploi.periodeEssai} options={OUI_NON_OPTIONS} disabled={disabled} onChange={(periodeEssai) => set('emploi', { periodeEssai })} />
        </FormRow>
      </FormBlock>

      <FormBlock title="Certification de l’agent de crédit">
        <tr>
          <td colSpan={2}>
            <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--imf-muted)', fontStyle: 'italic' }}>
              {TEXTE_CERTIFICATION}
            </p>
          </td>
        </tr>
        {text('certification', 'date', 'Date', 'date')}
        <FormRow label="Agent de crédit">
          <TextInput value={agentNom || 'Aucun agent attribué'} disabled onChange={() => undefined} />
          <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: 'var(--imf-muted)' }}>
            Agent attribué au dossier — non modifiable.
          </span>
        </FormRow>
      </FormBlock>
    </>
  );
}
