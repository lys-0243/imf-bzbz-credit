import { Injectable } from '@nestjs/common';
import type {
  LlmCompletion,
  LlmCompletionInput,
  LlmProvider,
} from './llm.provider';

@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  private get apiKey() {
    return process.env.OPENAI_API_KEY?.trim() || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletion> {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_API_KEY non configurée');
    }
    const model = input.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.3,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
    });
    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Réponse OpenAI vide');
    return { text, model: body.model || model };
  }
}
