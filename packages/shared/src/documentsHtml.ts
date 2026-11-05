import { GARANTIE_TYPE_LABELS, valeurBien } from './cf5Garanties';
import { buildDocumentsContexte, type DossierContexte } from './dossierSynthese';
import type { ParametresImf } from './parametresImf';

/**
 * Documents juridiques éditables (éditeur web) : HTML sémantique généré depuis
 * le dossier — titres, paragraphes, listes, tableaux — que l’éditeur sait
 * modifier et que l’export .docx convertit.
 */
export const DOCUMENTS_EDITABLES = ['LETTRE', 'CONTRAT', 'GAGE', 'CAUTION'] as const;
export type DocumentEditable = (typeof DOCUMENTS_EDITABLES)[number];

export const DOCUMENT_EDITABLE_LABELS: Record<DocumentEditable, string> = {
  LETTRE: 'Lettre d’octroi',
  CONTRAT: 'Contrat de prêt',
  GAGE: 'Contrat de gage',
  CAUTION: 'Contrat de cautionnement',
};

const ROLES_EDITION_DOCUMENTS = ['RESPONSABLE_CREDIT', 'DG', 'ADMIN'];
const ETATS_EDITION_DOCUMENTS = ['DIRECTION', 'CONSEIL', 'A_DECAISSER'];

export function isDocumentEditable(v: unknown): v is DocumentEditable {
  return typeof v === 'string' && (DOCUMENTS_EDITABLES as readonly string[]).includes(v);
}

/** RC, DG et admin, de la Direction jusqu’au décaissement. */
export function peutEditerDocument(role: string, etat: string): boolean {
  return ROLES_EDITION_DOCUMENTS.includes(role) && ETATS_EDITION_DOCUMENTS.includes(etat);
}

// —— Formats communs aux documents (aussi utilisés par les gabarits web) ——

export function docMontant(n: number | null | undefined, devise = 'USD'): string {
  if (n == null || !Number.isFinite(n)) return '…………';
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
}

export function docPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '…';
  return `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: digits })} %`;
}

export function docDate(iso: string | null | undefined): string {
  if (!iso) return '…… / …… / ……';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString('fr-FR');
}

export function docBlank(v: unknown): string {
  return v == null || String(v).trim() === '' ? '………………………' : String(v);
}

/** Échappement HTML de toute valeur dynamique. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Institution = ParametresImf['institution'];
type DocCtx = ReturnType<typeof buildDocumentsContexte>;

const p = (html: string, align?: 'center' | 'right' | 'justify') =>
  `<p${align ? ` style="text-align: ${align}"` : ''}>${html}</p>`;
const h1 = (t: string) => `<h1 style="text-align: center">${esc(t)}</h1>`;
const h2 = (t: string) => `<h2>${esc(t)}</h2>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`;
const article = (titre: string, ...corps: string[]) => h2(titre) + corps.join('');

function entete(i: Institution): string {
  return (
    p(`<strong>${esc(i.raisonSociale)}</strong>`, 'center') +
    p(`${esc(i.formeJuridique)} — ${esc(i.siege)}`, 'center') +
    p(`RCCM ${esc(i.rccm)} — Id. Nat. ${esc(i.idNat)} — Agrément BCC ${esc(i.agrementBcc)}`, 'center') +
    '<hr>'
  );
}

function parties(i: Institution, autres: Array<{ nom: string; adresse: string; denomination: string }>): string {
  return (
    p(
      `<strong>ENTRE :</strong> L’Institution de Microfinance ${esc(i.raisonSociale)}, ${esc(i.formeJuridique)}, ayant son siège social à ${esc(i.siege)}, immatriculée au RCCM sous le numéro ${esc(i.rccm)}, Id. Nat. ${esc(i.idNat)}, agrément de la BCC N°${esc(i.agrementBcc)}, représentée par Monsieur ${esc(i.representantNom)}, ${esc(i.representantFonction)} dûment habilité aux effets des présentes,`,
      'justify',
    ) +
    p('Ci-après dénommée « le Prêteur ou le Créancier » d’une part ;') +
    autres
      .map(
        (a) =>
          p(
            `<strong>ET</strong> ${esc(docBlank(a.nom))}, ${esc(docBlank(a.adresse))}, ${esc(i.villeSignature)} en République Démocratique du Congo,`,
          ) + p(`Ci-après dénommé « ${esc(a.denomination)} », d’autre part ;`),
      )
      .join('')
  );
}

const SITUATIONS_FIN = [
  'Poursuite de nature à compromettre la fortune et la réputation de l’Emprunteur ;',
  'Détournement des biens donnés en gage ;',
  'Saisie pratiquée à charge de l’Emprunteur ;',
  'Non-versement intégral et/ou aux dates prévues du principal et/ou des intérêts indiqués dans le plan de paiement ;',
  'Modification de la valeur et/ou de la quantité des garanties ;',
  'Exposition du Prêteur à la perte, pour quelque cause que ce soit, de la sûreté garantissant les engagements de l’Emprunteur.',
];

function clauseAntiCorruption(n: number, i: Institution): string {
  return article(
    `Article ${n} : Anti-corruption`,
    p(
      `Les parties s’interdisent directement ou indirectement d’offrir, de donner, de promettre de donner ou d’autoriser un don d’argent, un prêt, un cadeau ou toute autre chose de valeur afin d’inciter un fonctionnaire à commettre un acte en violation de son devoir légal, ou afin d’obtenir un avantage indu, ou pour inciter un agent de ${esc(i.raisonSociale)} à utiliser son influence de manière indue dans le but d’affecter ou d’influencer tout acte ou toute décision.`,
      'justify',
    ),
    p(
      'Chacune des parties ne pourra pas conclure d’arrangements ou effectuer de transactions, directement ou indirectement, contrevenant à toute loi ou réglementation congolaise, internationale ou autre en matière de lutte contre le blanchiment d’argent ou contre le financement du terrorisme, ou avec des personnes dont les noms figurent sur les listes noires congolaises, des Nations Unies ou de tout autre État, restreignant ou interdisant des transactions avec ces personnes.',
      'justify',
    ),
  );
}

function clauseConfidentialite(n: number): string {
  return article(
    `Article ${n} : Confidentialité`,
    p(
      'Chaque partie s’engage à entretenir la confidentialité de toute information qu’elle reçoit de l’autre partie, laquelle, sans être spécialement libellée comme confidentielle, est par convention ou autrement connue comme confidentielle.',
      'justify',
    ),
    p(
      'Cette obligation ne s’applique pas aux informations qui étaient, au moment de leur divulgation, déjà connues du public par un acte au-delà du contrôle de la partie tenue à la confidentialité, ou fournies par une tierce personne sans restriction de confidentialité. Chaque partie peut dévoiler une information confidentielle à ses employés ou à un tiers pour autant que cela soit nécessaire à l’exécution des présentes ou exigé par la loi, à condition d’assumer la pleine responsabilité de toute violation de confidentialité.',
      'justify',
    ),
  );
}

function clauseReclamations(n: number, i: Institution): string {
  return article(
    `Article ${n} : Gestion des réclamations et des plaintes`,
    p(
      `Pour toute réclamation ou plainte relative à l’exécution des présentes, l’Emprunteur est tenu de s’adresser au centre d’appels du Prêteur par téléphone (${esc(i.telephoneReclamations)}) ou par mail (${esc(i.emailReclamations)}).`,
      'justify',
    ),
  );
}

function clauseFinContrat(n: number, debiteur = 'l’Emprunteur'): string {
  return article(
    `Article ${n} : Fin du contrat`,
    p(
      'Le remboursement du principal, des intérêts et des frais contractés par l’Emprunteur dans les délais et termes organisés par le contrat de prêt met fin au présent contrat.',
      'justify',
    ),
    p(
      `Toutefois, en cas de survenance des situations ci-après, le Prêteur mettra fin au présent contrat, de plein droit et sans préavis, tout en exigeant de ${esc(debiteur)} le remboursement immédiat des sommes dues (capital, intérêts et pénalités) :`,
      'justify',
    ),
    ul(SITUATIONS_FIN.map(esc)),
  );
}

function clauseLitiges(n: number, i: Institution): string {
  return article(
    `Article ${n} : Notification et règlement des litiges`,
    p(
      'Pour l’exécution des présentes et de toutes leurs suites, les parties déclarent avoir élu domicile aux adresses reprises dans le préambule, où tous exploits, correspondances, actes et jugements pourront leur être signifiés.',
      'justify',
    ),
    p(
      `Le présent contrat est régi par la législation en vigueur en République Démocratique du Congo. À défaut d’arrangement à l’amiable, les cours et tribunaux de ${esc(i.villeSignature)} seront compétents pour connaître de toute contestation relative à son exécution ou à son interprétation.`,
      'justify',
    ),
  );
}

function faitA(i: Institution, date: string): string {
  return p(`Fait à ${esc(i.villeSignature)}, le ${esc(docDate(date))}, en deux exemplaires originaux.`);
}

/** Bloc de signatures : tableau à deux colonnes. */
function signatures(items: Array<{ titre: string; nom?: string; mention?: string }>): string {
  const cell = (s?: { titre: string; nom?: string; mention?: string }) =>
    s
      ? `<td><p><strong>${esc(s.titre)}</strong></p>${s.nom ? p(esc(s.nom)) : ''}${s.mention ? p(`<em>${esc(s.mention)}</em>`) : ''}<p></p><p></p></td>`
      : '<td><p></p></td>';
  const rows: string[] = [];
  for (let k = 0; k < items.length; k += 2) rows.push(`<tr>${cell(items[k])}${cell(items[k + 1])}</tr>`);
  return `<table><tbody>${rows.join('')}</tbody></table>`;
}

const ligneSignatureCodebiteur = (d: DocCtx) => ({
  titre: 'Codébiteur',
  nom: d.demandeur.conjointNomComplet || undefined,
  mention: 'Faire précéder la signature de « lu et approuvé »',
});

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

function lettre(d: DocCtx): string {
  const { institution: i, demandeur, demande, conditions, devise } = d;
  return (
    entete(i) +
    p(`${esc(i.villeSignature)}, le ${esc(docDate(d.dateDocument))}`, 'right') +
    p(`<strong>${esc(docBlank(demandeur.nomComplet))}</strong><br>${esc(docBlank(demandeur.adresseDomicile))}`) +
    p(`<strong>Référence :</strong> votre lettre de demande de crédit en date du ${esc(docDate(demande.dateDemande))}`) +
    p(
      `En réponse à votre demande de crédit datée du ${esc(docDate(demande.dateDemande))} pour l’obtention d’un prêt d’un montant de ${esc(docMontant(demande.montant, devise))}, nous venons par la présente vous informer que ${esc(i.raisonSociale)} a approuvé votre demande de crédit et a accepté de vous accorder le montant de <strong>${esc(docMontant(conditions.montant, devise))}</strong> pour une durée de <strong>${esc(docBlank(conditions.dureeMois))}</strong> mois.`,
      'justify',
    ) +
    p('Les lignes ci-après reprennent les conditions relatives à l’octroi du crédit :') +
    article(
      '1. L’utilisation du crédit',
      ul(['Le crédit reçu doit être utilisé pour le but auquel il a été octroyé ;', 'Tout détournement de fonds n’est pas permis.']),
    ) +
    article(
      '2. Terme du crédit, intérêts et autres frais',
      ul([
        `${esc(i.raisonSociale)} ne permet aucun retard de remboursement ;`,
        'Tout retard de remboursement est sanctionné par une pénalité ;',
        `Les frais d’étude de dossier doivent être payés avant le décaissement (soit ${esc(docPct(d.conditionsTarifaires.fraisDossierPct, 1))} du montant accordé, ${esc(docMontant(conditions.frais?.fraisDossier, devise))}).`,
      ]),
    ) +
    article(
      `3. Liste des activités non financées par ${i.raisonSociale}`,
      p(`${esc(i.raisonSociale)} ne finance pas les activités suivantes non permises par la loi :`),
      ul(LISTE_EXCLUSION.map(esc)),
    ) +
    p('Le client certifie qu’il est en conformité avec la liste d’exclusion, les lois et réglementations locales.') +
    p(
      'Nous vous remercions de votre aimable clientèle et vous prions de bien vouloir confirmer l’acceptation de notre offre en signant une copie de cette lettre.',
      'justify',
    ) +
    p(`Veuillez agréer, ${esc(demandeur.civilite || 'Madame, Monsieur')} ${esc(demandeur.nom)}, nos salutations distinguées.`) +
    signatures([
      { titre: i.raisonSociale, nom: `Le président du comité de crédit — ${i.presidentComiteCredit}` },
      { titre: 'Le client', nom: demandeur.nomComplet, mention: 'Mention « lu et approuvé »' },
    ])
  );
}

function contrat(d: DocCtx): string {
  const { institution: i, conditionsTarifaires: c, demandeur, conditions, devise } = d;
  const m = (n: number | null | undefined) => esc(docMontant(n, devise));
  const plan = d.echeancier
    ? `<table><thead><tr><th><p>N°</p></th><th><p>Mensualité</p></th><th><p>Intérêts</p></th><th><p>Principal</p></th><th><p>Capital restant dû</p></th></tr></thead><tbody>${d.echeancier.lignes
        .map(
          (l) =>
            `<tr><td><p>${l.numero}</p></td><td>${p(m(l.mensualite), 'right')}</td><td>${p(m(l.interet), 'right')}</td><td>${p(m(l.principal), 'right')}</td><td>${p(m(l.capitalRestant), 'right')}</td></tr>`,
        )
        .join(
          '',
        )}<tr><td><p><strong>Total</strong></p></td><td>${p(`<strong>${m(d.echeancier.totalMensualites)}</strong>`, 'right')}</td><td>${p(`<strong>${m(d.echeancier.totalInterets)}</strong>`, 'right')}</td><td>${p(`<strong>${m(conditions.montant)}</strong>`, 'right')}</td><td><p></p></td></tr></tbody></table>`
    : p('Plan indisponible : montant, durée ou taux manquant.');

  return (
    entete(i) +
    h1('Contrat de prêt individuel (IL)') +
    parties(i, [{ nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' }]) +
    p('<strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>') +
    article(
      'Article 1 : Objet',
      p(
        `Le Prêteur consent à l’Emprunteur, qui accepte, un prêt d’un montant de <strong>${m(conditions.montant)}</strong> ouvert dans les livres du Prêteur au nom de l’Emprunteur conformément à sa politique de crédit et aux autres pratiques en vigueur.`,
        'justify',
      ),
      p('Ce prêt est accordé exclusivement pour l’objet de la demande de prêt. Tout détournement de fonds pour d’autres utilisations n’est pas permis.', 'justify'),
    ) +
    article(
      'Article 2 : Activités interdites',
      p(
        'Le Prêteur ne finance que les activités licites et légales tant en droit positif congolais qu’en droit des traités et conventions internationaux. Toute activité reprise sur la liste d’exclusion du Prêteur, dont l’Emprunteur déclare avoir reçu copie à la signature du présent contrat, est interdite.',
        'justify',
      ),
    ) +
    article(
      'Article 3 : Caractéristiques du prêt',
      p(
        `Ce prêt est de la catégorie des prêts individuels, variant de ${m(c.montantMinPret)} à ${m(c.montantMaxPret)}, remboursables mensuellement au taux dégressif et garantis par un gage.`,
        'justify',
      ),
    ) +
    article(
      'Article 4 : Durée du prêt',
      p(
        `Le présent crédit est consenti pour une période de <strong>${esc(docBlank(conditions.dureeMois))}</strong> mois prenant cours à la date du décaissement${d.dateDeboursement ? ` (${esc(docDate(d.dateDeboursement))})` : ''}.`,
        'justify',
      ),
    ) +
    article(
      'Article 5 : Obligations du codébiteur',
      p(
        'En signant ce contrat, le codébiteur accepte qu’il a les mêmes obligations et responsabilités que l’Emprunteur ou débiteur principal. En aucun cas, il ne peut prétexter ignorance des présentes clauses. Il s’engage donc solidairement avec l’Emprunteur et répond des engagements liés à ce contrat.',
        'justify',
      ),
    ) +
    article(
      'Article 6 : Risques significatifs',
      p('L’Emprunteur déclare avoir accepté les risques significatifs suivants :'),
      ul([
        'Paiement des pénalités, perte des biens mis en gage et inéligibilité aux prochains crédits en cas de violation des clauses contractuelles, de non-respect de l’échéancier, de détournement de l’objet du crédit, de surendettement et de fraude ;',
        'Perte éventuelle due à la dépréciation de la monnaie nationale si le prêt est libellé en devises.',
      ]),
    ) +
    article(
      'Article 7 : Différents frais',
      p(`Outre le taux d’intérêt dégressif mensuel de <strong>${esc(docPct(conditions.tauxMensuel))}</strong>, l’Emprunteur est tenu :`),
      ul([
        `au paiement des frais de dossier fixés à ${esc(docPct(c.fraisDossierPct, 1))} (${m(conditions.frais?.fraisDossier)}) ;`,
        `aux frais de décaissement fixés à ${esc(docPct(c.fraisDecaissementPct, 1))} du montant accordé (${m(conditions.frais?.fraisDecaissement)}) ;`,
        `au SMS alerte : ${m(c.smsMensuel)} par mois ;`,
        `aux frais d’inscription des gages fixés à ${esc(docPct(c.fraisInscriptionGagePct, 1))} du montant du crédit ;`,
        `à la TVA fixée à ${esc(docPct(c.tvaPct, 0))} (${m(conditions.frais?.tva)}).`,
      ]),
    ) +
    article(
      'Article 8 : Remboursement du prêt',
      p(
        'Le remboursement s’effectue par les sommes et aux échéances renseignées dans le plan de remboursement en annexe 1, signé par les parties, que l’Emprunteur s’engage à respecter scrupuleusement. Tout remboursement effectué après les échéances entraîne un accroissement journalier du taux d’intérêt.',
        'justify',
      ),
      p(
        'Le remboursement doit être effectué dans les agences du Prêteur ou auprès des agents agréés munis d’un terminal de paiement. Aucun remboursement ne peut être effectué entre les mains d’un employé ; l’Emprunteur est tenu d’informer le Prêteur de tout employé qui exigerait des paiements ou cadeaux.',
        'justify',
      ),
      p(
        'Au nom du principe de l’unicité des comptes, l’Emprunteur autorise le Prêteur à débiter les échéances dans l’un quelconque de ses comptes ouverts dans ses livres, en monnaie nationale ou étrangère.',
        'justify',
      ),
      p(
        'L’Emprunteur peut payer par anticipation. S’il souhaite solder son crédit, il ne pourra le faire qu’après avoir payé au moins trois échéances ; il devra alors payer intégralement le capital restant dû et 50 % des intérêts restant dus.',
        'justify',
      ),
    ) +
    article(
      'Article 9 : Déchéance du terme',
      p(
        'Le défaut de règlement d’une ou plusieurs échéances vaut déchéance du terme sans autre formalité après sommation de payer dans les 48 heures, précédée d’une mise en demeure restée sans suite pendant sept jours. La dette est alors intégralement exigible.',
        'justify',
      ),
    ) +
    article(
      'Article 10 : Sûreté',
      p(
        'Pour sûreté du remboursement de toutes les sommes en principal, intérêts et frais accessoires, l’Emprunteur affecte en gage au profit du Prêteur les biens repris à l’annexe du contrat de gage, qui fait partie intégrante du présent contrat.',
        'justify',
      ),
    ) +
    article(
      'Article 11 : Épargne obligatoire',
      p(
        `L’Emprunteur verse une garantie en numéraire correspondant à ${esc(docPct(c.cautionPct, 0))} du prêt octroyé (${m(conditions.frais?.caution)}), constituée en dépôt bloqué. Il n’y aura accès qu’après apurement complet de la créance. En cas d’insolvabilité ou de résiliation, le Prêteur opère la compensation prévue par les articles 181 à 191 du Code civil congolais livre III sur ce dépôt, de plein droit et sans notification.`,
        'justify',
      ),
    ) +
    article(
      'Article 12 : Pénalités de retard',
      p(
        `En cas de non-paiement à l’échéance du principal et/ou des intérêts, l’Emprunteur paie, en plus des intérêts dus, ${esc(docPct(c.penaliteRetardPct, 1))} de pénalités sur le capital restant dû à compter du lendemain de l’échéance jusqu’à l’apurement.`,
        'justify',
      ),
    ) +
    clauseAntiCorruption(13, i) +
    clauseConfidentialite(14) +
    clauseReclamations(15, i) +
    clauseFinContrat(16) +
    clauseLitiges(17, i) +
    article('Article 18 : Prise de connaissance du contrat', p('L’Emprunteur reconnaît avoir retiré et lu le présent contrat le jour de sa signature.')) +
    faitA(i, d.dateDocument) +
    signatures([
      { titre: `Pour ${i.raisonSociale}`, nom: `${i.representantNom}, ${i.representantFonction}` },
      { titre: 'L’Emprunteur', nom: demandeur.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
      ligneSignatureCodebiteur(d),
    ]) +
    h2('Annexe 1 — Plan de remboursement') +
    p(
      `Montant ${m(conditions.montant)} — ${esc(docBlank(conditions.dureeMois))} mois — taux mensuel ${esc(docPct(conditions.tauxMensuel))} — mensualités constantes.`,
    ) +
    plan +
    signatures([{ titre: 'Le Prêteur' }, { titre: 'L’Emprunteur' }])
  );
}

function gage(d: DocCtx, ctx: DossierContexte): string {
  const { institution: i, demandeur, conditions, devise } = d;
  const calc = { montantPropose: conditions.montant ?? 0, cautionPct: d.conditionsTarifaires.cautionPct };
  const deviseBiens = String(ctx.payload.devise || 'USD');
  const biens = d.biensGages.length
    ? d.biensGages
        .map(
          (b) =>
            `<tr><td><p>${esc(b.type ? GARANTIE_TYPE_LABELS[b.type] : '—')}</p></td><td><p>${esc(b.description)}</p></td><td><p>${esc(b.etat || '—')}</p></td><td>${p(esc(docMontant(valeurBien(b, calc), deviseBiens)), 'right')}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4"><p>Aucun bien saisi (CF5.1)</p></td></tr>';

  return (
    entete(i) +
    h1('Contrat de gage') +
    parties(i, [{ nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' }]) +
    p('<strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>') +
    article(
      'Article 1 : Objet',
      p(
        `Ce contrat est l’accessoire du contrat de prêt individuel conclu le ${esc(docDate(d.dateDocument))} par lequel le Prêteur a accordé à l’Emprunteur un crédit de ${esc(docMontant(conditions.montant, devise))} remboursable mensuellement pendant ${esc(docBlank(conditions.dureeMois))} mois.`,
        'justify',
      ),
    ) +
    article(
      'Article 2 : Biens donnés en gage',
      p(
        'Pour garantir le remboursement du prêt, l’Emprunteur accepte de donner en gage les biens décrits dans la liste en annexe 1. Il déclare que ces biens sont sa pleine et exclusive propriété, qu’il peut les déposer librement en gage et qu’ils sont libres de toutes charges.',
        'justify',
      ),
    ) +
    article(
      'Article 3 : Déclaration sur l’honneur de l’Emprunteur',
      ul([
        'Les annexes au présent contrat en font partie intégrante ;',
        'Toute information donnée au Prêteur est exacte, exhaustive et reflète sa position financière ;',
        'Il ne fait l’objet d’aucune poursuite judiciaire ;',
        'Il reste juridiquement responsable de tous les biens en sa possession ; le Prêteur ne peut être exposé aux poursuites judiciaires pour la vente de ces biens.',
      ]),
    ) +
    article(
      'Article 4 : Sort des biens donnés en gage',
      p(
        'Le Prêteur laisse les biens à la responsabilité de l’Emprunteur, qui doit les garder et les gérer en bon père de famille, sans pouvoir en disposer, les céder ni les changer tant que subsiste le présent contrat. Le Prêteur se réserve le droit de récupérer les biens en cours de contrat en cas de non-respect du plan de remboursement. À défaut d’accord, il peut obtenir du tribunal l’autorisation de les vendre ; le surplus éventuel est restitué à l’Emprunteur après rétention des frais.',
        'justify',
      ),
    ) +
    article(
      'Article 5 : Durée du contrat',
      p(
        'Le présent contrat est conclu pour la même durée que le contrat de prêt. Si, à l’échéance, le Prêteur n’est pas totalement désintéressé, il subsiste jusqu’à parfait remboursement.',
        'justify',
      ),
    ) +
    article(
      'Article 6 : Obligations du codébiteur',
      p(
        'Le codébiteur a les mêmes obligations et responsabilités que l’Emprunteur, s’engage solidairement avec lui et répond des engagements liés à ce contrat.',
        'justify',
      ),
    ) +
    clauseAntiCorruption(7, i) +
    clauseConfidentialite(8) +
    clauseReclamations(9, i) +
    clauseFinContrat(10) +
    clauseLitiges(11, i) +
    article('Article 12 : Prise de connaissance du contrat', p('L’Emprunteur reconnaît avoir retiré et lu le présent contrat le jour de sa signature.')) +
    faitA(i, d.dateDocument) +
    signatures([
      { titre: `Pour ${i.raisonSociale}`, nom: `${i.representantNom}, ${i.representantFonction}` },
      { titre: 'L’Emprunteur', nom: demandeur.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
      ligneSignatureCodebiteur(d),
    ]) +
    h2('Annexe 1 — Liste des biens donnés en gage (CF5.1)') +
    `<table><thead><tr><th><p>Type</p></th><th><p>Description</p></th><th><p>État</p></th><th><p>Valeur estimée</p></th></tr></thead><tbody>${biens}</tbody></table>`
  );
}

function caution(d: DocCtx): string {
  const { institution: i, demandeur, garant, conditions, devise } = d;
  return (
    entete(i) +
    h1('Contrat de cautionnement') +
    parties(i, [
      { nom: garant.nomComplet, adresse: garant.adresse, denomination: 'la Caution' },
      { nom: demandeur.nomComplet, adresse: demandeur.adresseDomicile, denomination: 'l’Emprunteur ou débiteur' },
    ]) +
    p('<strong>IL A ÉTÉ PRÉALABLEMENT EXPOSÉ CE QUI SUIT :</strong>') +
    ul([
      `Le Prêteur et l’Emprunteur ont conclu en date du ${esc(docDate(d.dateDocument))} un contrat de prêt en vertu duquel le Prêteur a accordé au débiteur un montant de ${esc(docMontant(conditions.montant, devise))}, dont une copie est reprise en annexe ;`,
      'La Caution déclare avoir pris connaissance du contrat de prêt ;',
      'La Caution consent à garantir les engagements pris par le débiteur en vertu du contrat de prêt.',
    ]) +
    p('<strong>AINSI, IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>') +
    article(
      'Article 1 : Objet',
      p(
        `Ce contrat de cautionnement est l’accessoire du contrat de prêt conclu entre le Prêteur et l’Emprunteur en date du ${esc(docDate(d.dateDocument))}. La Caution certifie connaître les obligations prises par l’Emprunteur.`,
        'justify',
      ),
    ) +
    article(
      'Article 2 : Durée du contrat',
      p(
        'Le présent contrat est conclu pour la même durée que le contrat de prêt principal ; il subsiste jusqu’à parfait remboursement si le Prêteur n’est pas totalement désintéressé à l’échéance.',
        'justify',
      ),
    ) +
    article(
      'Article 3 : Obligations de la Caution',
      p(
        'La Caution garantit le remboursement total et intégral de toutes les sommes dues par l’Emprunteur et se porte caution solidaire, sans bénéfice de discussion ni de division, pour la totalité du principal, des intérêts, des intérêts accrus et des pénalités éventuelles de retard.',
        'justify',
      ),
    ) +
    article('Article 4 : Obligations du Prêteur', p('À la demande de la Caution, le Prêteur est tenu de fournir l’état des dettes de l’Emprunteur.')) +
    article(
      'Article 5 : Effet du contrat de prêt sur le contrat de cautionnement',
      p(
        'En cas d’insolvabilité de l’Emprunteur et/ou de résiliation du contrat de prêt pour défaut de paiement, la Caution est tenue solidairement et conjointement avec l’Emprunteur de rembourser la totalité du principal, des intérêts, des pénalités et des frais d’exécution. Le Prêteur n’est pas tenu d’épuiser ses recours contre l’Emprunteur avant d’exercer ses droits contre elle.',
        'justify',
      ),
    ) +
    article(
      'Article 6 : Intérêts personnels de la Caution',
      p(
        'La Caution déclare ne pas avoir d’intérêts personnels dans le prêt et ne pas avoir le droit de recevoir un quelconque paiement de l’Emprunteur pour ce cautionnement.',
        'justify',
      ),
    ) +
    article(
      'Article 7 : Déchéance du terme',
      p(
        'Le défaut de règlement d’une ou plusieurs échéances vaut déchéance du terme sans besoin de sommer ou de mettre en demeure la Caution. La dette devient intégralement exigible.',
        'justify',
      ),
    ) +
    clauseConfidentialite(8) +
    clauseReclamations(9, i) +
    clauseFinContrat(10, 'la Caution') +
    clauseLitiges(11, i) +
    article('Article 12 : Prise de connaissance du contrat', p('La Caution reconnaît avoir retiré et lu le présent contrat le jour de sa signature.')) +
    faitA(i, d.dateDocument) +
    signatures([
      { titre: `Pour ${i.raisonSociale}`, nom: `${i.representantNom}, ${i.representantFonction}` },
      { titre: 'La Caution', nom: garant.nomComplet, mention: 'Faire précéder la signature de « lu et approuvé »' },
    ])
  );
}

/** Contenu initial d’un document éditable, généré depuis le dossier. */
export function genererDocumentHtml(
  doc: DocumentEditable,
  ctx: DossierContexte,
  aujourdhui = new Date(),
): string {
  const d = buildDocumentsContexte(ctx, aujourdhui);
  switch (doc) {
    case 'LETTRE':
      return lettre(d);
    case 'CONTRAT':
      return contrat(d);
    case 'GAGE':
      return gage(d, ctx);
    case 'CAUTION':
      return caution(d);
  }
}
