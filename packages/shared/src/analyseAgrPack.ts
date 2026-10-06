/** Pack Analyse_AGR.xlsx : tous produits sauf DARE_DARE. */
export const DARE_DARE_PRODUCT_CODE = 'DARE_DARE';

export function usesAnalyseAgrPack(
  produitCode: string | null | undefined,
): boolean {
  if (!produitCode) return true;
  return produitCode !== DARE_DARE_PRODUCT_CODE;
}
