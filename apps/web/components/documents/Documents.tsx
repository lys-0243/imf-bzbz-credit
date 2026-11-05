import {
  DECISION_COMITE_LABELS,
  buildDocumentsContexte,
  type DossierContexte,
} from '@imf/shared';
import {
  DocHeader,
  P,
  Signatures,
  blank,
  dateFr,
  docStyles as styles,
  money,
  pct,
} from './DocumentKit';

/** Documents non éditables (transfert, PV, mémo) ; lettre et contrats : voir documentsHtml (shared). */
type DocProps = { ctx: DossierContexte; doc: ReturnType<typeof buildDocumentsContexte> };

export function DocumentTransfert({ doc }: DocProps) {
  const { institution, demandeur, demande, conditions, devise } = doc;
  const libelle = `Déboursement du prêt n° ${blank(doc.numeroCredit)} par transfert en compte d’épargne n° ${blank(demande.numeroCompte)} pour le crédit de ${demandeur.civilite} ${demandeur.nomComplet}`;
  return (
    <>
      <DocHeader institution={institution} />
      <h1 className={styles.title}>Document de transfert</h1>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th>Déboursement (IL)</th>
            <td>Date : {dateFr(doc.dateDeboursement || doc.dateDocument)}</td>
          </tr>
          <tr>
            <th>Nom</th>
            <td>{demandeur.nomComplet}</td>
          </tr>
          <tr>
            <th>A/c N°</th>
            <td>{blank(demande.numeroCompte)}</td>
          </tr>
          <tr>
            <th># Prêt</th>
            <td>{blank(doc.numeroCredit)}</td>
          </tr>
        </tbody>
      </table>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Type de transaction</th>
            <th>Description</th>
            <th className={styles.num}>Montant {devise}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TRANSFERT</td>
            <td>{libelle}</td>
            <td className={styles.num}>{money(conditions.montant, devise)}</td>
          </tr>
          <tr>
            <th colSpan={2} className={styles.num}>
              Total ({devise})
            </th>
            <th className={styles.num}>{money(conditions.montant, devise)}</th>
          </tr>
        </tbody>
      </table>
      <P>
        <strong>Montant en lettres :</strong> {doc.montantEnLettres || '…'}
      </P>
      <Signatures items={[{ titre: 'Préparé par' }, { titre: 'Autorisé par (1)' }, { titre: 'Autorisé par (2)' }, { titre: 'Transfert effectué par', mention: 'Date et heure' }]} />
    </>
  );
}

function Membres({ titre, membres }: { titre: string; membres: Array<{ nom: string; position: string }> }) {
  return (
    <>
      <h2 className={styles.subtitle}>{titre}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Position</th>
            <th>Signature</th>
          </tr>
        </thead>
        <tbody>
          {(membres.length ? membres : [{ nom: '', position: '' }]).map((m, i) => (
            <tr key={i}>
              <td>{blank(m.nom)}</td>
              <td>{blank(m.position)}</td>
              <td style={{ height: 28 }} />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function PvComite({ ctx, doc }: DocProps) {
  const pv = ctx.formulaires.DECISION_COMITE;
  const { institution, demandeur, demande, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <h1 className={styles.title}>PV du comité de crédit</h1>
      <table className={styles.table}>
        <tbody>
          <tr><th>Agence</th><td>{blank(pv.agence)}</td><th>Date du comité</th><td>{dateFr(pv.dateComite)}</td></tr>
          <tr><th>Agent de crédit</th><td>{blank(ctx.agent?.displayName)}</td><th>Date de la demande</th><td>{dateFr(demande.dateDemande)}</td></tr>
          <tr><th>Nom du business</th><td>{blank(demande.business.nom)}</td><th>Date de déboursement</th><td>{dateFr(pv.dateDeboursement)}</td></tr>
          <tr><th>Nom du demandeur</th><td>{demandeur.nomComplet}</td><th>N° découvert bancaire</th><td>{blank(pv.numeroDecouvert)}</td></tr>
        </tbody>
      </table>
      <h2 className={styles.subtitle}>Observations du comité de crédit</h2>
      <P>{blank(pv.observations)}</P>
      <P>
        <strong>Décision : {pv.decision ? DECISION_COMITE_LABELS[pv.decision] : '…'}</strong>
        {pv.decision === 'APPROUVE'
          ? ` — le comité de crédit a approuvé le montant de ${money(conditions.montant, devise)} pour ${blank(conditions.dureeMois)} mois au taux mensuel de ${pct(conditions.tauxMensuel)}.`
          : ''}
      </P>
      {pv.decision && pv.decision !== 'APPROUVE' ? (
        <>
          <h2 className={styles.subtitle}>Raisons du rejet ou du report</h2>
          <P>{blank(pv.raisonsRejetReport)}</P>
        </>
      ) : null}
      <h2 className={styles.subtitle}>Conditions de déboursement</h2>
      <ul className={styles.list}>
        <li>Caution ({pct(doc.conditionsTarifaires.cautionPct, 0)}) : {money(conditions.frais?.caution, devise)}</li>
        <li>Frais de dossier : {money(conditions.frais?.fraisDossier, devise)}</li>
        <li>Frais de décaissement : {money(conditions.frais?.fraisDecaissement, devise)}</li>
        <li>TVA : {money(conditions.frais?.tva, devise)}</li>
        <li>SMS alerte : {money(doc.conditionsTarifaires.smsMensuel, devise)} par mois</li>
      </ul>
      <Membres titre="Comité de crédit — membres votants" membres={pv.comiteCredit.votants} />
      {pv.comiteCredit.participants.length ? <Membres titre="Comité de crédit — membres participants" membres={pv.comiteCredit.participants} /> : null}
      {pv.comiteGestion.votants.length ? <Membres titre="Comité de gestion — membres votants" membres={pv.comiteGestion.votants} /> : null}
      {pv.comiteGestion.participants.length ? <Membres titre="Comité de gestion — membres participants" membres={pv.comiteGestion.participants} /> : null}
    </>
  );
}

export function MemoPca({ ctx, doc }: DocProps) {
  const pca = ctx.formulaires.APPRO_PCA;
  const pv = ctx.formulaires.DECISION_COMITE;
  const { institution, demandeur, demande, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <P>
        <strong>MÉMO N° {blank(pca.numeroMemo)}</strong>
      </P>
      <h1 className={styles.title}>Demande d’approbation de crédit supérieur à {money(ctx.parametres.seuilApprobationCa, devise)}</h1>
      <table className={styles.table}>
        <tbody>
          <tr><th>Agence</th><td>{blank(pca.agence)}</td><th>Date de la demande d’approbation</th><td>{dateFr(pca.dateDemande)}</td></tr>
          <tr><th>Responsable</th><td>{blank(pca.responsable)}</td><th>Date du comité de crédit</th><td>{dateFr(pv.dateComite)}</td></tr>
          <tr><th>Destination</th><td>Conseil d’administration</td><th>N° de compte</th><td>{blank(demande.numeroCompte)}</td></tr>
          <tr><th>Responsable</th><td>Président du Conseil d’administration</td><th>N° de crédit</th><td>{blank(pv.numeroCredit)}</td></tr>
        </tbody>
      </table>
      <table className={styles.table}>
        <tbody>
          <tr><th>Nom du client</th><td>{demandeur.nomComplet}</td></tr>
          <tr><th>Prêt sollicité</th><td>{money(demande.montant, devise)} — {blank(demande.dureeMois)} mois</td></tr>
          <tr><th>But de l’investissement</th><td>{blank(demande.commentaireBut || demande.but)}</td></tr>
        </tbody>
      </table>
      <h2 className={styles.subtitle}>Observations du comité de crédit</h2>
      <P>
        Le comité de crédit a proposé le montant de {money(Number(pv.montantApprouve) || null, devise)} pour {blank(pv.dureeMois)} mois, au taux d’intérêt de {pct(conditions.tauxMensuel)}.
      </P>
      <h2 className={styles.subtitle}>Conditions de déboursement</h2>
      <ul className={styles.list}>
        <li>Caution : {money(conditions.frais?.caution, devise)} ; frais de dossier : {money(conditions.frais?.fraisDossier, devise)}</li>
        <li>Frais de décaissement : {money(conditions.frais?.fraisDecaissement, devise)} ; TVA : {money(conditions.frais?.tva, devise)}</li>
      </ul>
      <h2 className={styles.subtitle}>Observation et commentaire des membres du Conseil d’administration</h2>
      <P>{blank(pca.observationsCa)}</P>
      <h2 className={styles.subtitle}>Décision du Conseil d’administration</h2>
      <P>
        <strong>{pca.decision ? DECISION_COMITE_LABELS[pca.decision] : 'Approuvé / Reporté / Rejeté'}</strong>
        {pca.decision === 'APPROUVE' ? ` — montant approuvé : ${money(conditions.montant, devise)} ; durée approuvée : ${blank(conditions.dureeMois)} mois.` : ''}
      </P>
      <Membres titre="Membres" membres={pca.membres} />
    </>
  );
}
