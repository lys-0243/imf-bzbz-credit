'use client';

import {
  GARANTIE_TYPE_LABELS,
  buildFormulaireAnalyse,
  type DossierContexte,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import { FormBlock, FormRow, formatMoney, formatPct } from '../FormKit';

const d = (v: unknown) => (v == null || v === '' ? '—' : String(v));

const SOURCE_LABELS = {
  APPRO_PCA: 'mémo PCA',
  DECISION_COMITE: 'PV du comité',
  CF2_5: 'proposition CF 2.5',
  DEMANDE: 'demande',
} as const;

/** « Formulaire d’analyse » (synthèse calculée, lecture seule). */
export function FormulaireAnalyseView({ ctx }: { ctx: DossierContexte }) {
  const fa = buildFormulaireAnalyse(ctx);
  const devise = fa.demande.devise;
  const money = (n: number | null | undefined) => (n == null ? '—' : formatMoney(n, devise));
  const cr = fa.compteResultat;
  const b = fa.bilan;

  return (
    <>
      <FormBlock title="Résumé">
        <FormRow label="Nom du demandeur">{d(fa.demandeur.nomComplet)}</FormRow>
        <FormRow label="Pièce d’identité">{[fa.demandeur.typePiece, fa.demandeur.numeroPiece].filter(Boolean).join(' — ') || '—'}</FormRow>
        <FormRow label="Activité">{d(fa.demande.business.nom || fa.demande.business.type)}</FormRow>
        <FormRow label="Type d’activité / expérience">{[fa.demande.business.type, fa.demande.business.experience].filter(Boolean).join(' — ') || '—'}</FormRow>
        <FormRow label="Adresse de l’activité">{d(fa.demande.business.adresse)}</FormRow>
        <FormRow label="Adresse du demandeur">{d(fa.demandeur.adresseDomicile)}</FormRow>
        <FormRow label="Téléphone">{d(fa.demandeur.telephone)}</FormRow>
      </FormBlock>

      <FormBlock title="Information sur le prêt">
        <FormRow label="Montant demandé / durée">{money(fa.demande.montant)} — {d(fa.demande.dureeMois)} mois</FormRow>
        <FormRow label={`Montant retenu (${SOURCE_LABELS[fa.conditions.source]})`}>
          {money(fa.conditions.montant)} — {d(fa.conditions.dureeMois)} mois
        </FormRow>
        <FormRow label="Taux d’intérêt mensuel">{formatPct(fa.conditions.tauxMensuel, 2)}</FormRow>
        <FormRow label="Mensualité">{money(fa.conditions.mensualite)}</FormRow>
        <FormRow label="Frais de dossier">{money(fa.conditions.frais?.fraisDossier)}</FormRow>
        <FormRow label="Méthode de remboursement">Mensualités égales, sans période de grâce</FormRow>
        <FormRow label="But du prêt">{d(fa.demande.but)} {fa.demande.commentaireBut ? `— ${fa.demande.commentaireBut}` : ''}</FormRow>
      </FormBlock>

      <FormBlock title="Compte d’exploitation">
        <FormRow label="Ventes">{money(cr?.chiffreAffaires)}</FormRow>
        <FormRow label="Coût des marchandises vendues">{money(cr?.cmv)}</FormRow>
        <FormRow label="Profit brut">{money(cr?.profitBrut)}</FormRow>
        <FormRow label="Autres revenus">{money(cr?.autresRevenus)}</FormRow>
        <FormRow label="Dépenses opérationnelles">{money(cr?.depensesExploitation)}</FormRow>
        <FormRow label="Dépenses privées">{money(cr?.depensesPrivees)}</FormRow>
        <FormRow label="Capacité de paiement">{money(cr?.capacitePaiement)}</FormRow>
      </FormBlock>

      <FormBlock title="Bilan">
        <FormRow label="Caisse / banque / stock">{money(b?.caisse)} / {money(b?.banque)} / {money(b?.stock)}</FormRow>
        <FormRow label="Total actif circulant">{money(b?.actifsCirculants)}</FormRow>
        <FormRow label="Actifs immobilisés">{money(b?.actifsImmobilises)}</FormRow>
        <FormRow label="Total actif">{money(b?.totalActifs)}</FormRow>
        <FormRow label="Dettes CT / LT">{money(b?.dettesCourtTerme)} / {money(b?.dettesLongTerme)}</FormRow>
        <FormRow label="Capital propre">{money(b?.capitalPropre)}</FormRow>
      </FormBlock>

      <FormBlock title="Ratios">
        {fa.ratios.map((r) => (
          <FormRow key={r.key} label={`${r.label} (norme ${r.norme})`}>
            {r.value == null ? '—' : r.asPercent ? formatPct(r.value) : r.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
            {r.ok === false ? <span className={`${styles.badge} ${styles.badgeWarn}`} style={{ marginLeft: 8 }}>Hors norme</span> : null}
          </FormRow>
        ))}
      </FormBlock>

      <FormBlock title="Information sur les garanties">
        {fa.garanties.lignes.length ? (
          fa.garanties.lignes.map((l) => (
            <FormRow key={l.type} label={GARANTIE_TYPE_LABELS[l.type]}>
              Marché {money(l.valeurMarche)} — gage {money(l.valeurGage)} — {formatPct(l.contribution)}
            </FormRow>
          ))
        ) : (
          <FormRow label="Garanties">Aucune garantie saisie (CF5.1)</FormRow>
        )}
        <FormRow label="Total">{money(fa.garanties.totalGage)}</FormRow>
      </FormBlock>

      <FormBlock title="Information familiale">
        <FormRow label="Personnes dans le ménage">{fa.menage.nombrePersonnes}</FormRow>
        <FormRow label="Enfants de moins de 18 ans">{fa.menage.enfantsMoins18}</FormRow>
        <FormRow label="Adultes avec / sans source de revenu">{fa.menage.adultesAvecRevenu} / {fa.menage.adultesSansRevenu}</FormRow>
        <FormRow label="Personnes de plus de 60 ans">{fa.menage.plusDe60Ans}</FormRow>
        <FormRow label="Total dépenses familiales (mois)">{money(fa.menage.depensesFamiliales)}</FormRow>
      </FormBlock>

      <FormBlock title="Co-débiteur, garant et personnes de référence">
        {fa.personnes.length ? (
          fa.personnes.map((p, i) => (
            <FormRow key={i} label={p.role}>
              {p.nom}
              {p.contact ? ` — ${p.contact}` : ''}
              {p.revenu != null ? ` — revenu ${money(p.revenu)}` : ''}
            </FormRow>
          ))
        ) : (
          <FormRow label="Personnes">—</FormRow>
        )}
      </FormBlock>

      <FormBlock title="Analyse des risques">
        {fa.risques.length ? (
          fa.risques.map((r, i) => (
            <FormRow key={i} label={`Risque ${i + 1} : ${r.risque}`}>
              Mitigation : {d(r.mitigation)}
            </FormRow>
          ))
        ) : (
          <FormRow label="Risques">—</FormRow>
        )}
      </FormBlock>

      <FormBlock title="Agent de crédit">
        <FormRow label="Nom">{d(ctx.agent?.displayName)}</FormRow>
      </FormBlock>
    </>
  );
}
