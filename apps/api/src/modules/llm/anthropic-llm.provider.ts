import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { NOM_ASSISTANT_IA } from '@imf/shared';
import type {
  LlmCompletion,
  LlmCompletionInput,
  LlmProvider,
} from './llm.provider';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Retire d'éventuelles balises ```json et garde l'objet JSON. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Fournisseur LLM unique : Claude via l'API Anthropic (clé Console). */
@Injectable()
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;

  private get apiKey() {
    return process.env.ANTHROPIC_API_KEY?.trim() || '';
  }

  private get effort(): Effort {
    const v = process.env.ANTHROPIC_EFFORT?.trim().toLowerCase() as Effort;
    return EFFORTS.includes(v) ? v : 'medium';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletion> {
    if (!this.isConfigured()) {
      throw new Error('ANTHROPIC_API_KEY non configurée');
    }
    this.client ??= new Anthropic({ apiKey: this.apiKey });
    const model =
      input.model || process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5-5';

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
          output_config: { effort: this.effort },
          // Si un classifieur de sécurité refuse, l'API rejoue sur un modèle de repli.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { timeout: input.timeoutMs ?? 120_000 },
      );
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        throw new Error('ANTHROPIC_API_KEY invalide');
      }
      if (e instanceof Anthropic.RateLimitError) {
        throw new Error(`${NOM_ASSISTANT_IA} : limite de débit atteinte, réessayer plus tard`);
      }
      if (e instanceof Anthropic.APIConnectionTimeoutError) {
        throw new Error(`${NOM_ASSISTANT_IA} : délai de réponse dépassé`);
      }
      if (e instanceof Anthropic.APIConnectionError) {
        throw new Error(`${NOM_ASSISTANT_IA} : connexion impossible`);
      }
      if (e instanceof Anthropic.APIError) {
        throw new Error(`${NOM_ASSISTANT_IA} : erreur HTTP ${e.status ?? '?'}`);
      }
      throw e;
    }

    if (response.stop_reason === 'refusal') {
      throw new Error(`${NOM_ASSISTANT_IA} a refusé la demande`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Réponse ${NOM_ASSISTANT_IA} tronquée (max_tokens)`);
    }
    const text = response.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
      .trim();
    if (!text) throw new Error(`Réponse ${NOM_ASSISTANT_IA} vide`);
    return {
      text: input.json ? extractJsonObject(text) : text,
      model: response.model || model,
    };
  }
}
