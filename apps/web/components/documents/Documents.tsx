import {
  DECISION_COMITE_LABELS,
  GARANTIE_TYPE_LABELS,
  buildDocumentsContexte,
  valeurBien,
  type DossierContexte,
} from '@imf/shared';
import {
  Article,
  ClauseAntiCorruption,
  ClauseConfidentialite,
  ClauseFinContrat,
  ClauseLitiges,
  ClauseReclamations,
  DocHeader,
  FaitA,
  P,
  Parties,
  Signatures,
  blank,
  dateFr,
  docStyles as styles,
  money,
  pct,
} from './DocumentKit';

type DocProps = { ctx: DossierContexte; doc: ReturnType<typeof buildDocumentsContexte> };

/** Liste d’exclusion — feuille LETTRE, section 3. */
const LISTE_EXCLUSION = [
  'Toute activité en rapport d’une manière ou d’une autre avec le blanchiment des capitaux et le financement du terrorisme',
  'Le commerce de tous types de drogues illégales (chanvre, alcool indigène) et de tout produit pharmaceutique contrefait',
  'Tous produits jugés dangereux pour la santé ou portant atteinte aux bonnes mœurs',
  'Toutes activités contre l’environnement, le développement social et le développement durable',
  'Les explosifs, les mines anti-personnelles (mercure rouge, coltan, uranium, ivoire…)',
  'Les changeurs de monnaie de rue (cambistes), les banques Lambert et les frappeurs de monnaie',
  'Les maisons closes ou réseaux de prostitution',
  'Toutes activités liées à la pornographie',
  'Les réseaux d’immigration clandestine',
  'La production et la vente d’armes et munitions',
  'Les produits cosmétiques dangereux',
  'Le transport naval de pétrole ou d’autres substances hasardeuses dans des tankers non conformes aux exigences de l’Organisation maritime internationale',
  'Le commerce des carburants non conforme à la loi',
  'Toute activité impliquant des formes de travail forcé ou de travail abusif des enfants, des pratiques discriminatoires, ou empêchant les employés d’exercer leurs droits légaux d’association et de négociation collective',
  'La délocalisation des peuples indigènes de leurs terres traditionnelles ou coutumières',
];

export function LettreOctroi({ doc }: DocProps) {
  const { institution, demandeur, demande, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <P>
        {institution.villeSignature}, le {dateFr(doc.dateDocument)}
      </P>
      <P>
        <strong>{blank(demandeur.nomComplet)}</strong>
        <br />
        {blank(demandeur.adresseDomicile)}
      </P>
      <P>
        <strong>Référence :</strong> votre lettre de demande de crédit en date du {dateFr(demande.dateDemande)}
      </P>
      <P>
        En réponse à votre demande de crédit datée du {dateFr(demande.dateDemande)} pour l’obtention d’un prêt d’un
        montant de {money(demande.montant, devise)}, nous venons par la présente vous informer que{' '}
        {institution.raisonSociale} a approuvé votre demande de crédit et a accepté de vous accorder le montant de{' '}
        <strong>{money(conditions.montant, devise)}</strong> pour une durée de <strong>{blank(conditions.dureeMois)}</strong>{' '}
        mois.
      </P>
      <P>Les lignes ci-après reprennent les conditions relatives à l’octroi du crédit :</P>
      <Article titre="1. L’utilisation du crédit">
        <ul className={styles.list}>
          <li>Le crédit reçu doit être utilisé pour le but auquel il a été octroyé ;</li>
          <li>Tout détournement de fonds n’est pas permis.</li>
        </ul>
      </Article>
      <Article titre="2. Terme du crédit, intérêts et autres frais">
        <ul className={styles.list}>
          <li>{institution.raisonSociale} ne permet aucun retard de remboursement ;</li>
          <li>Tout retard de remboursement est sanctionné par une pénalité ;</li>
          <li>
            Les frais d’étude de dossier doivent être payés avant le décaissement (soit{' '}
            {pct(doc.conditionsTarifaires.fraisDossierPct, 1)} du montant accordé, {money(conditions.frais?.fraisDossier, devise)}).
          </li>
        </ul>
      </Article>
      <Article titre={`3. Liste des activités non financées par ${institution.raisonSociale}`}>
        <P>{institution.raisonSociale} ne finance pas les activités suivantes non permises par la loi :</P>
        <ul className={styles.list}>
          {LISTE_EXCLUSION.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Article>
      <P>Le client certifie qu’il est en conformité avec la liste d’exclusion, les lois et réglementations locales.</P>
      <P>
        Nous vous remercions de votre aimable clientèle et vous prions de bien vouloir confirmer l’acceptation de notre
        offre en signant une copie de cette lettre.
      </P>
      <P>
        Veuillez agréer, {demandeur.civilite || 'Madame, Monsieur'} {demandeur.nom}, nos salutations distinguées.
      </P>
      <Signatures
        items={[
          { titre: institution.raisonSociale, nom: `Le président du comité de crédit — ${institution.presidentComiteCredit}` },
          { titre: 'Le client', nom: demandeur.nomComplet, mention: 'Mention « lu et approuvé »' },
        ]}
      />
    </>
  );
}

export function ContratPret({ doc }: DocProps) {
  const { institution, conditionsTarifaires: c, demandeur, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <h1 className={styles.title}>Contrat de prêt individuel (IL)</h1>
      <Parties institution={institution} autres={[{ nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' }]} />
      <P>
        <strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>
      </P>
      <div className={styles.columns}>
        <Article titre="Article 1 : Objet">
          <P>
            Le Prêteur consent à l’Emprunteur, qui accepte, un prêt d’un montant de <strong>{money(conditions.montant, devise)}</strong>{' '}
            ouvert dans les livres du Prêteur au nom de l’Emprunteur conformément à sa politique de crédit et aux autres
            pratiques en vigueur.
          </P>
          <P>Ce prêt est accordé exclusivement pour l’objet de la demande de prêt. Tout détournement de fonds pour d’autres utilisations n’est pas permis.</P>
        </Article>
        <Article titre="Article 2 : Activités interdites">
          <P>
            Le Prêteur ne finance que les activités licites et légales tant en droit positif congolais qu’en droit des
            traités et conventions internationaux. Toute activité reprise sur la liste d’exclusion du Prêteur, dont
            l’Emprunteur déclare avoir reçu copie à la signature du présent contrat, est interdite.
          </P>
        </Article>
        <Article titre="Article 3 : Caractéristiques du prêt">
          <P>
            Ce prêt est de la catégorie des prêts individuels, variant de {money(c.montantMinPret, devise)} à{' '}
            {money(c.montantMaxPret, devise)}, remboursables mensuellement au taux dégressif et garantis par un gage.
          </P>
        </Article>
        <Article titre="Article 4 : Durée du prêt">
          <P>
            Le présent crédit est consenti pour une période de <strong>{blank(conditions.dureeMois)}</strong> mois prenant
            cours à la date du décaissement{doc.dateDeboursement ? ` (${dateFr(doc.dateDeboursement)})` : ''}.
          </P>
        </Article>
        <Article titre="Article 5 : Obligations du codébiteur">
          <P>
            En signant ce contrat, le codébiteur accepte qu’il a les mêmes obligations et responsabilités que
            l’Emprunteur ou débiteur principal. En aucun cas, il ne peut prétexter ignorance des présentes clauses. Il
            s’engage donc solidairement avec l’Emprunteur et répond des engagements liés à ce contrat.
          </P>
        </Article>
        <Article titre="Article 6 : Risques significatifs">
          <P>L’Emprunteur déclare avoir accepté les risques significatifs suivants :</P>
          <ul className={styles.list}>
            <li>
              Paiement des pénalités, perte des biens mis en gage et inéligibilité aux prochains crédits en cas de
              violation des clauses contractuelles, de non-respect de l’échéancier, de détournement de l’objet du crédit,
              de surendettement et de fraude ;
            </li>
            <li>Perte éventuelle due à la dépréciation de la monnaie nationale si le prêt est libellé en devises.</li>
          </ul>
        </Article>
        <Article titre="Article 7 : Différents frais">
          <P>Outre le taux d’intérêt dégressif mensuel de <strong>{pct(conditions.tauxMensuel)}</strong>, l’Emprunteur est tenu :</P>
          <ul className={styles.list}>
            <li>au paiement des frais de dossier fixés à {pct(c.fraisDossierPct, 1)} ({money(conditions.frais?.fraisDossier, devise)}) ;</li>
            <li>aux frais de décaissement fixés à {pct(c.fraisDecaissementPct, 1)} du montant accordé ({money(conditions.frais?.fraisDecaissement, devise)}) ;</li>
            <li>au SMS alerte : {money(c.smsMensuel, devise)} par mois ;</li>
            <li>aux frais d’inscription des gages fixés à {pct(c.fraisInscriptionGagePct, 1)} du montant du crédit ;</li>
            <li>à la TVA fixée à {pct(c.tvaPct, 0)} ({money(conditions.frais?.tva, devise)}).</li>
          </ul>
        </Article>
        <Article titre="Article 8 : Remboursement du prêt">
          <P>
            Le remboursement s’effectue par les sommes et aux échéances renseignées dans le plan de remboursement en
            annexe 1, signé par les parties, que l’Emprunteur s’engage à respecter scrupuleusement. Tout remboursement
            effectué après les échéances entraîne un accroissement journalier du taux d’intérêt.
          </P>
          <P>
            Le remboursement doit être effectué dans les agences du Prêteur ou auprès des agents agréés munis d’un
            terminal de paiement. Aucun remboursement ne peut être effectué entre les mains d’un employé ; l’Emprunteur
            est tenu d’informer le Prêteur de tout employé qui exigerait des paiements ou cadeaux.
          </P>
          <P>
            Au nom du principe de l’unicité des comptes, l’Emprunteur autorise le Prêteur à débiter les échéances dans
            l’un quelconque de ses comptes ouverts dans ses livres, en monnaie nationale ou étrangère.
          </P>
          <P>
            L’Emprunteur peut payer par anticipation. S’il souhaite solder son crédit, il ne pourra le faire qu’après
            avoir payé au moins trois échéances ; il devra alors payer intégralement le capital restant dû et 50 % des
            intérêts restant dus.
          </P>
        </Article>
        <Article titre="Article 9 : Déchéance du terme">
          <P>
            Le défaut de règlement d’une ou plusieurs échéances vaut déchéance du terme sans autre formalité après
            sommation de payer dans les 48 heures, précédée d’une mise en demeure restée sans suite pendant sept jours.
            La dette est alors intégralement exigible.
          </P>
        </Article>
        <Article titre="Article 10 : Sûreté">
          <P>
            Pour sûreté du remboursement de toutes les sommes en principal, intérêts et frais accessoires, l’Emprunteur
            affecte en gage au profit du Prêteur les biens repris à l’annexe du contrat de gage, qui fait partie
            intégrante du présent contrat.
          </P>
        </Article>
        <Article titre="Article 11 : Épargne obligatoire">
          <P>
            L’Emprunteur verse une garantie en numéraire correspondant à {pct(c.cautionPct, 0)} du prêt octroyé (
            {money(conditions.frais?.caution, devise)}), constituée en dépôt bloqué. Il n’y aura accès qu’après
            apurement complet de la créance. En cas d’insolvabilité ou de résiliation, le Prêteur opère la compensation
            prévue par les articles 181 à 191 du Code civil congolais livre III sur ce dépôt, de plein droit et sans
            notification.
          </P>
        </Article>
        <Article titre="Article 12 : Pénalités de retard">
          <P>
            En cas de non-paiement à l’échéance du principal et/ou des intérêts, l’Emprunteur paie, en plus des intérêts
            dus, {pct(c.penaliteRetardPct, 1)} de pénalités sur le capital restant dû à compter du lendemain de
            l’échéance jusqu’à l’apurement.
          </P>
        </Article>
        <ClauseAntiCorruption numero={13} institution={institution} />
        <ClauseConfidentialite numero={14} />
        <ClauseReclamations numero={15} institution={institution} />
        <ClauseFinContrat numero={16} />
        <ClauseLitiges numero={17} institution={institution} />
        <Article titre="Article 18 : Prise de connaissance du contrat">
          <P>L’Emprunteur reconnaît avoir retiré et lu le présent contrat le jour de sa signature.</P>
        </Article>
      </div>
      <FaitA institution={institution} date={doc.dateDocument} />
      <Signatures
        items={[
          { titre: `Pour ${institution.raisonSociale}`, nom: `${institution.representantNom}, ${institution.representantFonction}` },
          { titre: 'L’Emprunteur', nom: demandeur.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
          { titre: 'Codébiteur', nom: demandeur.conjointNomComplet || undefined, mention: 'Faire précéder la signature de « lu et approuvé »' },
        ]}
      />

      <div className={styles.pageBreak} />
      <h2 className={styles.subtitle}>Annexe 1 — Plan de remboursement</h2>
      <P>
        Montant {money(conditions.montant, devise)} — {blank(conditions.dureeMois)} mois — taux mensuel {pct(conditions.tauxMensuel)} — mensualités constantes.
      </P>
      {doc.echeancier ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>N°</th>
              <th className={styles.num}>Mensualité</th>
              <th className={styles.num}>Intérêts</th>
              <th className={styles.num}>Principal</th>
              <th className={styles.num}>Capital restant dû</th>
            </tr>
          </thead>
          <tbody>
            {doc.echeancier.lignes.map((l) => (
              <tr key={l.numero}>
                <td>{l.numero}</td>
                <td className={styles.num}>{money(l.mensualite, devise)}</td>
                <td className={styles.num}>{money(l.interet, devise)}</td>
                <td className={styles.num}>{money(l.principal, devise)}</td>
                <td className={styles.num}>{money(l.capitalRestant, devise)}</td>
              </tr>
            ))}
            <tr>
              <th>Total</th>
              <th className={styles.num}>{money(doc.echeancier.totalMensualites, devise)}</th>
              <th className={styles.num}>{money(doc.echeancier.totalInterets, devise)}</th>
              <th className={styles.num}>{money(conditions.montant, devise)}</th>
              <th />
            </tr>
          </tbody>
        </table>
      ) : (
        <P>Plan indisponible : montant, durée ou taux manquant.</P>
      )}
      <Signatures items={[{ titre: 'Le Prêteur' }, { titre: 'L’Emprunteur' }]} />
    </>
  );
}

function AnnexeBiens({ doc, ctx }: DocProps) {
  const calc = { montantPropose: doc.conditions.montant ?? 0, cautionPct: doc.conditionsTarifaires.cautionPct };
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
          <th>État</th>
          <th className={styles.num}>Valeur estimée</th>
        </tr>
      </thead>
      <tbody>
        {doc.biensGages.length === 0 ? (
          <tr>
            <td colSpan={4}>Aucun bien saisi (CF5.1)</td>
          </tr>
        ) : null}
        {doc.biensGages.map((b) => (
          <tr key={b.id}>
            <td>{b.type ? GARANTIE_TYPE_LABELS[b.type] : '—'}</td>
            <td>{b.description}</td>
            <td>{b.etat || '—'}</td>
            <td className={styles.num}>{money(valeurBien(b, calc), String(ctx.payload.devise || 'USD'))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ContratGage({ doc, ctx }: DocProps) {
  const { institution, demandeur, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <h1 className={styles.title}>Contrat de gage</h1>
      <Parties institution={institution} autres={[{ nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' }]} />
      <P>
        <strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>
      </P>
      <div className={styles.columns}>
        <Article titre="Article 1 : Objet">
          <P>
            Ce contrat est l’accessoire du contrat de prêt individuel conclu le {dateFr(doc.dateDocument)} par lequel le
            Prêteur a accordé à l’Emprunteur un crédit de {money(conditions.montant, devise)} remboursable mensuellement
            pendant {blank(conditions.dureeMois)} mois.
          </P>
        </Article>
        <Article titre="Article 2 : Biens donnés en gage">
          <P>
            Pour garantir le remboursement du prêt, l’Emprunteur accepte de donner en gage les biens décrits dans la
            liste en annexe 1. Il déclare que ces biens sont sa pleine et exclusive propriété, qu’il peut les déposer
            librement en gage et qu’ils sont libres de toutes charges.
          </P>
        </Article>
        <Article titre="Article 3 : Déclaration sur l’honneur de l’Emprunteur">
          <ul className={styles.list}>
            <li>Les annexes au présent contrat en font partie intégrante ;</li>
            <li>Toute information donnée au Prêteur est exacte, exhaustive et reflète sa position financière ;</li>
            <li>Il ne fait l’objet d’aucune poursuite judiciaire ;</li>
            <li>
              Il reste juridiquement responsable de tous les biens en sa possession ; le Prêteur ne peut être exposé aux
              poursuites judiciaires pour la vente de ces biens.
            </li>
          </ul>
        </Article>
        <Article titre="Article 4 : Sort des biens donnés en gage">
          <P>
            Le Prêteur laisse les biens à la responsabilité de l’Emprunteur, qui doit les garder et les gérer en bon
            père de famille, sans pouvoir en disposer, les céder ni les changer tant que subsiste le présent contrat. Le
            Prêteur se réserve le droit de récupérer les biens en cours de contrat en cas de non-respect du plan de
            remboursement. À défaut d’accord, il peut obtenir du tribunal l’autorisation de les vendre ; le surplus
            éventuel est restitué à l’Emprunteur après rétention des frais.
          </P>
        </Article>
        <Article titre="Article 5 : Durée du contrat">
          <P>
            Le présent contrat est conclu pour la même durée que le contrat de prêt. Si, à l’échéance, le Prêteur n’est
            pas totalement désintéressé, il subsiste jusqu’à parfait remboursement.
          </P>
        </Article>
        <Article titre="Article 6 : Obligations du codébiteur">
          <P>
            Le codébiteur a les mêmes obligations et responsabilités que l’Emprunteur, s’engage solidairement avec lui
            et répond des engagements liés à ce contrat.
          </P>
        </Article>
        <ClauseAntiCorruption numero={7} institution={institution} />
        <ClauseConfidentialite numero={8} />
        <ClauseReclamations numero={9} institution={institution} />
        <ClauseFinContrat numero={10} />
        <ClauseLitiges numero={11} institution={institution} />
        <Article titre="Article 12 : Prise de connaissance du contrat">
          <P>L’Emprunteur reconnaît avoir retiré et lu le présent contrat le jour de sa signature.</P>
        </Article>
      </div>
      <FaitA institution={institution} date={doc.dateDocument} />
      <Signatures
        items={[
          { titre: `Pour ${institution.raisonSociale}`, nom: `${institution.representantNom}, ${institution.representantFonction}` },
          { titre: 'L’Emprunteur', nom: demandeur.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
          { titre: 'Codébiteur', nom: demandeur.conjointNomComplet || undefined, mention: 'Faire précéder la signature de « lu et approuvé »' },
        ]}
      />
      <h2 className={styles.subtitle}>Annexe 1 — Liste des biens donnés en gage (CF5.1)</h2>
      <AnnexeBiens doc={doc} ctx={ctx} />
    </>
  );
}

export function ContratCaution({ doc }: DocProps) {
  const { institution, demandeur, garant, conditions, devise } = doc;
  return (
    <>
      <DocHeader institution={institution} />
      <h1 className={styles.title}>Contrat de cautionnement</h1>
      <Parties
        institution={institution}
        autres={[
          { nom: garant.nomComplet, adresse: garant.adresse, denomination: 'la Caution' },
          { nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' },
        ]}
      />
      <P>
        <strong>IL A ÉTÉ PRÉALABLEMENT EXPOSÉ CE QUI SUIT :</strong>
      </P>
      <ul className={styles.list}>
        <li>
          Le Prêteur et l’Emprunteur ont conclu en date du {dateFr(doc.dateDocument)} un contrat de prêt en vertu duquel
          le Prêteur a accordé au débiteur un montant de {money(conditions.montant, devise)}, dont une copie est reprise
          en annexe ;
        </li>
        <li>La Caution déclare avoir pris connaissance du contrat de prêt ;</li>
        <li>La Caution consent à garantir les engagements pris par le débiteur en vertu du contrat de prêt.</li>
      </ul>
      <P>
        <strong>AINSI, IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>
      </P>
      <div className={styles.columns}>
        <Article titre="Article 1 : Objet">
          <P>
            Ce contrat de cautionnement est l’accessoire du contrat de prêt conclu entre le Prêteur et l’Emprunteur en
            date du {dateFr(doc.dateDocument)}. La Caution certifie connaître les obligations prises par l’Emprunteur.
          </P>
        </Article>
        <Article titre="Article 2 : Durée du contrat">
          <P>
            Le présent contrat est conclu pour la même durée que le contrat de prêt principal ; il subsiste jusqu’à
            parfait remboursement si le Prêteur n’est pas totalement désintéressé à l’échéance.
          </P>
        </Article>
        <Article titre="Article 3 : Obligations de la Caution">
          <P>
            La Caution garantit le remboursement total et intégral de toutes les sommes dues par l’Emprunteur et se porte
            caution solidaire, sans bénéfice de discussion ni de division, pour la totalité du principal, des intérêts,
            des intérêts accrus et des pénalités éventuelles de retard.
          </P>
        </Article>
        <Article titre="Article 4 : Obligations du Prêteur">
          <P>À la demande de la Caution, le Prêteur est tenu de fournir l’état des dettes de l’Emprunteur.</P>
        </Article>
        <Article titre="Article 5 : Effet du contrat de prêt sur le contrat de cautionnement">
          <P>
            En cas d’insolvabilité de l’Emprunteur et/ou de résiliation du contrat de prêt pour défaut de paiement, la
            Caution est tenue solidairement et conjointement avec l’Emprunteur de rembourser la totalité du principal,
            des intérêts, des pénalités et des frais d’exécution. Le Prêteur n’est pas tenu d’épuiser ses recours contre
            l’Emprunteur avant d’exercer ses droits contre elle.
          </P>
        </Article>
        <Article titre="Article 6 : Intérêts personnels de la Caution">
          <P>
            La Caution déclare ne pas avoir d’intérêts personnels dans le prêt et ne pas avoir le droit de recevoir un
            quelconque paiement de l’Emprunteur pour ce cautionnement.
          </P>
        </Article>
        <Article titre="Article 7 : Déchéance du terme">
          <P>
            Le défaut de règlement d’une ou plusieurs échéances vaut déchéance du terme sans besoin de sommer ou de
            mettre en demeure la Caution. La dette devient intégralement exigible.
          </P>
        </Article>
        <ClauseConfidentialite numero={8} />
        <ClauseReclamations numero={9} institution={institution} />
        <ClauseFinContrat numero={10} debiteur="la Caution" />
        <ClauseLitiges numero={11} institution={institution} />
        <Article titre="Article 12 : Prise de connaissance du contrat">
          <P>La Caution reconnaît avoir retiré et lu le présent contrat le jour de sa signature.</P>
        </Article>
      </div>
      <FaitA institution={institution} date={doc.dateDocument} />
      <Signatures
        items={[
          { titre: `Pour ${institution.raisonSociale}`, nom: `${institution.representantNom}, ${institution.representantFonction}` },
          { titre: 'La Caution', nom: garant.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
        ]}
      />
    </>
  );
}

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
