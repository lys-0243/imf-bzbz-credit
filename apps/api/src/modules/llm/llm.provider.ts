export type LlmCompletionInput = {
  system: string;
  user: string;
  /** Surcharge du modèle par défaut du fournisseur. */
  model?: string;
  /** Demande une réponse JSON (objet unique). */
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
};

export type LlmCompletion = {
  text: string;
  model: string;
};

/** Contrat fournisseur LLM — l'implémentation est choisie dans `llm.module.ts`. */
export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** Lève une erreur si l'appel échoue ou si la réponse est vide. */
  complete(input: LlmCompletionInput): Promise<LlmCompletion>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
