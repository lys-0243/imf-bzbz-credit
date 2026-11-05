import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm.provider';
import { OpenAiLlmProvider } from './openai-llm.provider';

/** Autre fournisseur : implémenter `LlmProvider` et le brancher ici. */
@Module({
  providers: [
    OpenAiLlmProvider,
    { provide: LLM_PROVIDER, useExisting: OpenAiLlmProvider },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
