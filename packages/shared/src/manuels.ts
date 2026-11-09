/**
 * Découpage des manuels (procédures IMF, instructions BCC) en sections
 * indexées en plein texte pour le RAG de conformité.
 */

export const SOURCES_MANUEL = ['IMF', 'BCC'] as const;
export type SourceManuel = (typeof SOURCES_MANUEL)[number];
export const SOURCE_MANUEL_LABELS: Record<SourceManuel, string> = {
  IMF: 'Manuel interne IMF',
  BCC: 'Banque Centrale du Congo',
};

export type SectionManuel = {
  ordre: number;
  numero: string;
  titre: string;
  contenu: string;
};

const TITRE_MOT_CLE =
  /^\s*((?:article|art\.)\s*\d+[a-z]?(?:[.\-]\d+)*|(?:chapitre|titre|section|partie|annexe)\s+(?:\d+|[ivxlc]+)\b)\s*[.:\-–—]?\s*(.*)$/i;
const TITRE_NUMEROTE = /^\s*(\d{1,2}(?:\.\d{1,2}){0,3})[.)]?\s+([A-ZÀ-ÖØ-Þ].{2,110})$/;

/** Mots max par section ; au-delà, redécoupage par paragraphes. */
export const MOTS_MAX_SECTION = 1200;

function compterMots(t: string) {
  return t.split(/\s+/).filter(Boolean).length;
}

function nettoyer(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/-\n(?=[a-zà-ÿ])/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detecterTitre(ligne: string): { numero: string; titre: string } | null {
  if (ligne.length > 160) return null;
  const m = TITRE_MOT_CLE.exec(ligne);
  if (m) return { numero: m[1].replace(/\s+/g, ' ').trim(), titre: (m[2] ?? '').trim() };
  const n = TITRE_NUMEROTE.exec(ligne);
  if (n && !/[.;:,]$/.test(n[2].trim())) return { numero: n[1], titre: n[2].trim() };
  return null;
}

/** Redécoupe un bloc trop long en morceaux de paragraphes, avec 1 paragraphe de recouvrement. */
function redecouper(contenu: string, max: number): string[] {
  if (compterMots(contenu) <= max) return [contenu];
  const paragraphes = contenu.split(/\n{2,}|\n(?=\s*[-•*]\s)/).filter((p) => p.trim());
  const morceaux: string[] = [];
  let courant: string[] = [];
  let mots = 0;
  for (const p of paragraphes) {
    const n = compterMots(p);
    if (mots + n > max && courant.length) {
      morceaux.push(courant.join('\n\n'));
      const dernier = courant[courant.length - 1];
      courant = compterMots(dernier) < max / 2 ? [dernier] : [];
      mots = courant.reduce((s, x) => s + compterMots(x), 0);
    }
    if (n > max) {
      // Paragraphe géant : coupe par mots.
      const w = p.split(/\s+/);
      for (let i = 0; i < w.length; i += max) morceaux.push(w.slice(i, i + max).join(' '));
      courant = [];
      mots = 0;
      continue;
    }
    courant.push(p);
    mots += n;
  }
  if (courant.length) morceaux.push(courant.join('\n\n'));
  return morceaux;
}

export function decouperManuel(texteBrut: string, max = MOTS_MAX_SECTION): SectionManuel[] {
  const texte = nettoyer(texteBrut);
  if (!texte) return [];
  const brutes: Array<{ numero: string; titre: string; lignes: string[] }> = [];
  let courante = { numero: '', titre: 'Préambule', lignes: [] as string[] };
  for (const ligne of texte.split('\n')) {
    const t = detecterTitre(ligne);
    if (t) {
      if (courante.lignes.join('').trim() || courante.numero) brutes.push(courante);
      courante = { numero: t.numero, titre: t.titre, lignes: [] };
      continue;
    }
    courante.lignes.push(ligne);
  }
  brutes.push(courante);

  const sections: SectionManuel[] = [];
  for (const b of brutes) {
    const contenu = b.lignes.join('\n').trim();
    if (!contenu) continue;
    const morceaux = redecouper(contenu, max);
    morceaux.forEach((m, i) =>
      sections.push({
        ordre: sections.length,
        numero: b.numero,
        titre: morceaux.length > 1 ? `${b.titre || b.numero} (partie ${i + 1})` : b.titre,
        contenu: m,
      }),
    );
  }
  return sections;
}

/**
 * Texte indexé sans accents ni ligatures (la base utilise la configuration
 * `french` sans l'extension unaccent) ; la requête est normalisée de même.
 */
export function sansAccents(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/[’‘]/g, "'");
}

/** Référence lisible d'une section (« Manuel de crédit — Article 12 : Garanties »). */
export function referenceSection(s: { manuelTitre: string; numero: string; titre: string }): string {
  const loc = [s.numero, s.titre].filter(Boolean).join(' : ');
  return loc ? `${s.manuelTitre} — ${loc}` : s.manuelTitre;
}
