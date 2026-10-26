'use client';

import {
  CF61_PROPOSITION_LABELS,
  GARANTIE_TYPE_LABELS,
  GARANTIE_TYPES,
  buildCf61Synthese,
  type Cf61Data,
} from '@imf/shared';
import {
  FormBlock,
  FormRow,
  OUI_NON_OPTIONS,
  SelectInput,
  TextArea,
  TextInput,
  formatMoney,
  optionsFromLabels,
} from '../FormKit';
import type { FicheProps } from './types';

const d = (v: unknown) => (v == null || v === '' ? '—' : String(v));

function dateFr(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? d(iso) : new Date(t).toLocaleDateString('fr-FR');
}

export function Cf61Fiche({ value, onChange, disabled, ctx, devise }: FicheProps<Cf61Data>) {
  const s = buildCf61Synthese({ ...ctx, formulaires: { ...ctx.formulaires, CF6_1: value } });
  const money = (n: number | null) => (n == null ? '—' : formatMoney(n, devise));

  return (
    <>
      <FormBlock title="Décision de prêt — en-tête">
        <FormRow label="Agence">
          <TextInput value={value.agence} disabled={disabled} onChange={(agence) => onChange({ ...value, agence })} />
        </FormRow>
        <FormRow label="Agent de crédit">{d(ctx.agent?.displayName)}</FormRow>
        <FormRow label="Superviseur de crédit">
          <TextInput value={value.superviseur} disabled={disabled} onChange={(superviseur) => onChange({ ...value, superviseur })} />
        </FormRow>
        <FormRow label="N° de compte">{d(s.numeroCompte)}</FormRow>
        <FormRow label="Demandeur">
          {s.nouveauClient == null ? '—' : s.nouveauClient ? 'Nouveau demandeur' : 'Demandeur habituel'}
        </FormRow>
        <FormRow label="Date de la demande">{dateFr(s.dateDemande)}</FormRow>
        <FormRow label="Date de la visite de l’activité">{d(s.dateVisiteActivite)}</FormRow>
        <FormRow label="Date de la visite du domicile">
          <TextInput type="date" value={value.dateVisiteDomicile} disabled={disabled} onChange={(dateVisiteDomicile) => onChange({ ...value, dateVisiteDomicile })} />
        </FormRow>
      </FormBlock>

      <FormBlock title="1. Demandeur">
        <FormRow label="Nom complet">{d(s.demandeur.nomComplet)}</FormRow>
        <FormRow label="Date de naissance">{d(s.demandeur.dateNaissance)}</FormRow>
        <FormRow label="Conjoint(e)">{d(s.demandeur.conjoint)}</FormRow>
        <FormRow label="Adresse de la résidence">{d(s.demandeur.adresse)}</FormRow>
        <FormRow label="État civil">{d(s.demandeur.etatCivil)}</FormRow>
        <FormRow label="Réside à ce lieu depuis">{d(s.demandeur.residenceDepuis)}</FormRow>
        <FormRow label="Propriété de la maison">{s.demandeur.statutLogement === 'proprietaire' ? 'Oui' : s.demandeur.statutLogement ? 'Non' : '—'}</FormRow>
      </FormBlock>

      <FormBlock title="2. Activité">
        <FormRow label="Activité commerciale">{d(s.activite.nom)}</FormRow>
        <FormRow label="Activité depuis">{d(s.activite.depuis)}</FormRow>
        <FormRow label="Propriété des locaux">{d(s.activite.proprieteLocaux)}</FormRow>
        <FormRow label="Location depuis">{d(s.activite.locationDepuis)}</FormRow>
        <FormRow label="Adresse de l’activité">{d(s.activite.adresse)}</FormRow>
      </FormBlock>

      <FormBlock title="3. Garant">
        <FormRow label="Garant requis selon la politique de crédit ?">
          <SelectInput value={value.garantRequis} options={OUI_NON_OPTIONS} disabled={disabled} onChange={(garantRequis) => onChange({ ...value, garantRequis })} />
        </FormRow>
        <FormRow label="Nom complet">{d(s.garant.nomComplet)}</FormRow>
        <FormRow label="Relation au demandeur">{d(s.garant.relation)}</FormRow>
        <FormRow label="Adresse du domicile">{d(s.garant.adresse)}</FormRow>
        <FormRow label="Activité / employé depuis">{d(s.garant.anciennete)}</FormRow>
        <FormRow label="Activité commerciale / employeur">{d(s.garant.activiteOuEmployeur)}</FormRow>
        <FormRow label="Profit mensuel net">{money(s.garant.revenuMensuelNet)}</FormRow>
      </FormBlock>

      <FormBlock title="4. Garanties (CF5.1)">
        {GARANTIE_TYPES.map((t) => (
          <FormRow key={t} label={GARANTIE_TYPE_LABELS[t]}>
            {money(s.garanties.parType[t])}
          </FormRow>
        ))}
        <FormRow label="Total">{money(s.garanties.total)}</FormRow>
      </FormBlock>

      <FormBlock title="5. Proposition">
        <FormRow label="Proposition de l’agent">
          <SelectInput
            value={value.proposition}
            options={optionsFromLabels(CF61_PROPOSITION_LABELS)}
            disabled={disabled}
            onChange={(proposition) => onChange({ ...value, proposition })}
          />
        </FormRow>
        <FormRow label="Montant proposé / sollicité">
          {money(s.proposition.montantPropose)} / {money(s.proposition.montantSollicite)}
        </FormRow>
        <FormRow label="Échéance proposée / sollicitée (mois)">
          {d(s.proposition.echeanceMois)} / {d(s.proposition.echeanceSollicitee)}
        </FormRow>
        <FormRow label="Remboursement mensuel proposé">{money(s.proposition.mensualite)}</FormRow>
        <FormRow label="Le paiement mensuel peut-il se faire facilement ?">
          <SelectInput value={value.paiementFacile} options={OUI_NON_OPTIONS} disabled={disabled} onChange={(paiementFacile) => onChange({ ...value, paiementFacile })} />
        </FormRow>
        <FormRow label="Commentaire">
          <TextArea value={value.commentaire} disabled={disabled} onChange={(commentaire) => onChange({ ...value, commentaire })} />
        </FormRow>
      </FormBlock>
    </>
  );
}
