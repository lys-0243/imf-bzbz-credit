# Mock core banking (jetable)

Ce dossier contient le faux core banking utilisé tant que l’IMF n’a pas fourni l’accès CBS.

## Suppression en fin de développement

1. Supprimer entièrement `apps/api/src/modules/banking/mock/`
2. Implémenter `RealCoreBankingService` (HTTP vers le CBS) et l’enregistrer dans `banking.module.ts`
3. Mettre `CORE_BANKING_PROVIDER=real` dans l’env
4. **Conserver** : `core-banking.port.ts`, `banking.controller.ts`, types `@imf/shared` (`BankingLookupResult`, etc.), appels `lookup` / `notifyDecision`

Ne pas coupler la logique métier au contenu de ce dossier.
