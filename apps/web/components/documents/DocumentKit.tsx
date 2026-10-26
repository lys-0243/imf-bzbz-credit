import type { ReactNode } from 'react';
import type { ParametresImf } from '@imf/shared';
import styles from './documents.module.css';

export { styles as docStyles };

export function money(n: number | null | undefined, devise = 'USD'): string {
  if (n == null || !Number.isFinite(n)) return '…………';
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '…';
  return `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: digits })} %`;
}

export function dateFr(iso: string | null | undefined): string {
  if (!iso) return '…… / …… / ……';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString('fr-FR');
}

export const blank = (v: unknown) => (v == null || String(v).trim() === '' ? '………………………' : String(v));

/** En-tête institutionnel (paramètres IMF). */
export function DocHeader({ institution }: { institution: ParametresImf['institution'] }) {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.headerName}>{institution.raisonSociale}</div>
        <div>{institution.formeJuridique}</div>
        <div>{institution.siege}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div>RCCM {institution.rccm}</div>
        <div>Id. Nat. {institution.idNat}</div>
        <div>Agrément BCC {institution.agrementBcc}</div>
      </div>
    </div>
  );
}

export function Article({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className={styles.article}>
      <div className={styles.articleTitle}>{titre}</div>
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className={styles.p}>{children}</p>;
}

/** Préambule « ENTRE … ET … » des contrats. */
export function Parties({
  institution,
  autres,
}: {
  institution: ParametresImf['institution'];
  autres: Array<{ nom: string; adresse: string; denomination: string }>;
}) {
  return (
    <div className={styles.article}>
      <P>
        <strong>ENTRE :</strong> L’Institution de Microfinance {institution.raisonSociale}, {institution.formeJuridique}, ayant
        son siège social à {institution.siege}, immatriculée au RCCM sous le numéro {institution.rccm}, Id. Nat.{' '}
        {institution.idNat}, agrément de la BCC N°{institution.agrementBcc}, représentée par Monsieur{' '}
        {institution.representantNom}, {institution.representantFonction} dûment habilité aux effets des présentes,
      </P>
      <P>Ci-après dénommée « le Prêteur ou le Créancier » d’une part ;</P>
      {autres.map((a, i) => (
        <div key={i}>
          <P>
            <strong>ET</strong> {blank(a.nom)}, {blank(a.adresse)}, {institution.villeSignature} en République
            Démocratique du Congo,
          </P>
          <P>Ci-après dénommé « {a.denomination} », d’autre part ;</P>
        </div>
      ))}
    </div>
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

export function ClauseAntiCorruption({ numero, institution }: { numero: number; institution: ParametresImf['institution'] }) {
  return (
    <Article titre={`Article ${numero} : Anti-corruption`}>
      <P>
        Les parties s’interdisent directement ou indirectement d’offrir, de donner, de promettre de donner ou
        d’autoriser un don d’argent, un prêt, un cadeau ou toute autre chose de valeur afin d’inciter un fonctionnaire
        à commettre un acte en violation de son devoir légal, ou afin d’obtenir un avantage indu, ou pour inciter un
        agent de {institution.raisonSociale} à utiliser son influence de manière indue dans le but d’affecter ou
        d’influencer tout acte ou toute décision.
      </P>
      <P>
        Chacune des parties ne pourra pas conclure d’arrangements ou effectuer de transactions, directement ou
        indirectement, contrevenant à toute loi ou réglementation congolaise, internationale ou autre en matière de
        lutte contre le blanchiment d’argent ou contre le financement du terrorisme, ou avec des personnes dont les
        noms figurent sur les listes noires congolaises, des Nations Unies ou de tout autre État, restreignant ou
        interdisant des transactions avec ces personnes.
      </P>
    </Article>
  );
}

export function ClauseConfidentialite({ numero }: { numero: number }) {
  return (
    <Article titre={`Article ${numero} : Confidentialité`}>
      <P>
        Chaque partie s’engage à entretenir la confidentialité de toute information qu’elle reçoit de l’autre partie,
        laquelle, sans être spécialement libellée comme confidentielle, est par convention ou autrement connue comme
        confidentielle.
      </P>
      <P>
        Cette obligation ne s’applique pas aux informations qui étaient, au moment de leur divulgation, déjà connues
        du public par un acte au-delà du contrôle de la partie tenue à la confidentialité, ou fournies par une tierce
        personne sans restriction de confidentialité. Chaque partie peut dévoiler une information confidentielle à ses
        employés ou à un tiers pour autant que cela soit nécessaire à l’exécution des présentes ou exigé par la loi, à
        condition d’assumer la pleine responsabilité de toute violation de confidentialité.
      </P>
    </Article>
  );
}

export function ClauseReclamations({ numero, institution }: { numero: number; institution: ParametresImf['institution'] }) {
  return (
    <Article titre={`Article ${numero} : Gestion des réclamations et des plaintes`}>
      <P>
        Pour toute réclamation ou plainte relative à l’exécution des présentes, l’Emprunteur est tenu de s’adresser au
        centre d’appels du Prêteur par téléphone ({institution.telephoneReclamations}) ou par mail (
        {institution.emailReclamations}).
      </P>
    </Article>
  );
}

export function ClauseFinContrat({ numero, debiteur = 'l’Emprunteur' }: { numero: number; debiteur?: string }) {
  return (
    <Article titre={`Article ${numero} : Fin du contrat`}>
      <P>
        Le remboursement du principal, des intérêts et des frais contractés par l’Emprunteur dans les délais et termes
        organisés par le contrat de prêt met fin au présent contrat.
      </P>
      <P>
        Toutefois, en cas de survenance des situations ci-après, le Prêteur mettra fin au présent contrat, de plein
        droit et sans préavis, tout en exigeant de {debiteur} le remboursement immédiat des sommes dues (capital,
        intérêts et pénalités) :
      </P>
      <ul className={styles.list}>
        {SITUATIONS_FIN.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </Article>
  );
}

export function ClauseLitiges({ numero, institution }: { numero: number; institution: ParametresImf['institution'] }) {
  return (
    <Article titre={`Article ${numero} : Notification et règlement des litiges`}>
      <P>
        Pour l’exécution des présentes et de toutes leurs suites, les parties déclarent avoir élu domicile aux
        adresses reprises dans le préambule, où tous exploits, correspondances, actes et jugements pourront leur être
        signifiés.
      </P>
      <P>
        Le présent contrat est régi par la législation en vigueur en République Démocratique du Congo. À défaut
        d’arrangement à l’amiable, les cours et tribunaux de {institution.villeSignature} seront compétents pour
        connaître de toute contestation relative à son exécution ou à son interprétation.
      </P>
    </Article>
  );
}

export function FaitA({ institution, date }: { institution: ParametresImf['institution']; date: string }) {
  return (
    <P>
      Fait à {institution.villeSignature}, le {dateFr(date)}, en deux exemplaires originaux.
    </P>
  );
}

export function Signatures({ items }: { items: Array<{ titre: string; nom?: string; mention?: string }> }) {
  return (
    <div className={styles.signatures}>
      {items.map((s) => (
        <div key={s.titre} className={styles.signature}>
          <strong>{s.titre}</strong>
          {s.nom ? <div>{s.nom}</div> : null}
          {s.mention ? <div className={styles.muted}>{s.mention}</div> : null}
        </div>
      ))}
    </div>
  );
}
