import { Module } from '@nestjs/common';
import { AnthropicLlmProvider } from './anthropic-llm.provider';
import { LLM_PROVIDER } from './llm.provider';

@Module({
  providers: [
    AnthropicLlmProvider,
    { provide: LLM_PROVIDER, useExisting: AnthropicLlmProvider },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
