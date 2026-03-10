import type { SourceKind } from '@contexted/shared';
import type { EmbeddingService, LlmService } from './dependencies.js';

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

function safeJsonParse<T>(text: string): T {
  const parsed = JSON.parse(text) as T;
  return parsed;
}

async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Provider request failed (${response.status}): ${body.slice(0, 320)}`);
  }

  return safeJsonParse<T>(body);
}

function buildRedactionPrompt(source: SourceKind, sourceText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a strict data privacy and summarization engine. The input has already been browser-redacted but may still contain residual PII. Return strict JSON with fields summary and piiRiskScore (0..100).'
    },
    {
      role: 'user',
      content: `Source=${source}\nText:\n${sourceText}`
    }
  ];
}

function buildVibePrompt(summary: string, source: SourceKind): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Generate a sharp but non-abusive 3 sentence vibe check. Keep it shareable and concise. Return plain text only.'
    },
    {
      role: 'user',
      content: `Source=${source}\nSummary:\n${summary}`
    }
  ];
}

function buildPairPrompt(profileA: string, profileB: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a psychological matchmaker. Return strict JSON with synergyPoints (array of exactly 2 strings) and confessionPrompt (string).'
    },
    {
      role: 'user',
      content: `Profile A:\n${profileA}\n\nProfile B:\n${profileB}`
    }
  ];
}

export class OpenAiLlmService implements LlmService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(input: { apiKey: string; model: string; baseUrl?: string }) {
    this.apiKey = input.apiKey;
    this.model = input.model;
    this.baseUrl = input.baseUrl ?? 'https://api.openai.com';
  }

  private async complete(messages: ChatMessage[], responseFormat?: 'json_object'): Promise<string> {
    const payload = {
      model: this.model,
      temperature: 0.2,
      messages,
      ...(responseFormat ? { response_format: { type: responseFormat } } : {})
    };

    const response = await fetchJson<{
      choices: Array<{ message: { content: string } }>;
    }>(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not include content.');
    }

    return content;
  }

  async redactAndSummarize(input: { sourceText: string; source: SourceKind }): Promise<{ summary: string; piiRiskScore: number }> {
    const content = await this.complete(buildRedactionPrompt(input.source, input.sourceText), 'json_object');
    const parsed = safeJsonParse<{ summary: string; piiRiskScore: number }>(content);
    return {
      summary: parsed.summary,
      piiRiskScore: parsed.piiRiskScore
    };
  }

  async generateVibeCheck(input: { summary: string; source: SourceKind }): Promise<string> {
    return this.complete(buildVibePrompt(input.summary, input.source));
  }

  async generatePairContent(input: { profileA: string; profileB: string }): Promise<{ synergyPoints: [string, string]; confessionPrompt: string }> {
    const content = await this.complete(buildPairPrompt(input.profileA, input.profileB), 'json_object');
    const parsed = safeJsonParse<{ synergyPoints: string[]; confessionPrompt: string }>(content);
    if (!Array.isArray(parsed.synergyPoints) || parsed.synergyPoints.length < 2) {
      throw new Error('OpenAI pair content is missing synergy points.');
    }

    return {
      synergyPoints: [parsed.synergyPoints[0], parsed.synergyPoints[1]],
      confessionPrompt: parsed.confessionPrompt
    };
  }
}

export class AnthropicLlmService implements LlmService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(input: { apiKey: string; model: string }) {
    this.apiKey = input.apiKey;
    this.model = input.model;
  }

  private async complete(messages: ChatMessage[]): Promise<string> {
    const [system, ...rest] = messages;

    const response = await fetchJson<{
      content: Array<{ type: string; text?: string }>;
    }>('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 700,
        temperature: 0.2,
        system: system.content,
        messages: rest
      })
    });

    const text = response.content.find((entry) => entry.type === 'text' && entry.text)?.text;
    if (!text) {
      throw new Error('Anthropic response did not include text content.');
    }

    return text;
  }

  async redactAndSummarize(input: { sourceText: string; source: SourceKind }): Promise<{ summary: string; piiRiskScore: number }> {
    const content = await this.complete(buildRedactionPrompt(input.source, input.sourceText));
    const parsed = safeJsonParse<{ summary: string; piiRiskScore: number }>(content);
    return {
      summary: parsed.summary,
      piiRiskScore: parsed.piiRiskScore
    };
  }

  async generateVibeCheck(input: { summary: string; source: SourceKind }): Promise<string> {
    return this.complete(buildVibePrompt(input.summary, input.source));
  }

  async generatePairContent(input: { profileA: string; profileB: string }): Promise<{ synergyPoints: [string, string]; confessionPrompt: string }> {
    const content = await this.complete(buildPairPrompt(input.profileA, input.profileB));
    const parsed = safeJsonParse<{ synergyPoints: string[]; confessionPrompt: string }>(content);
    if (!Array.isArray(parsed.synergyPoints) || parsed.synergyPoints.length < 2) {
      throw new Error('Anthropic pair content is missing synergy points.');
    }

    return {
      synergyPoints: [parsed.synergyPoints[0], parsed.synergyPoints[1]],
      confessionPrompt: parsed.confessionPrompt
    };
  }
}

export class OpenAiEmbeddingService implements EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(input: { apiKey: string; model: string; baseUrl?: string }) {
    this.apiKey = input.apiKey;
    this.model = input.model;
    this.baseUrl = input.baseUrl ?? 'https://api.openai.com';
  }

  async embed(input: string): Promise<number[]> {
    const response = await fetchJson<{
      data: Array<{ embedding: number[] }>;
    }>(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input
      })
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('OpenAI embedding response did not include vector data.');
    }

    return embedding;
  }
}

export class FallbackLlmService implements LlmService {
  private readonly primary: LlmService;
  private readonly secondary?: LlmService;

  constructor(input: { primary: LlmService; secondary?: LlmService }) {
    this.primary = input.primary;
    this.secondary = input.secondary;
  }

  async redactAndSummarize(input: { sourceText: string; source: SourceKind }): Promise<{ summary: string; piiRiskScore: number }> {
    try {
      return await this.primary.redactAndSummarize(input);
    } catch (error) {
      if (!this.secondary) {
        throw error;
      }
      return this.secondary.redactAndSummarize(input);
    }
  }

  async generateVibeCheck(input: { summary: string; source: SourceKind }): Promise<string> {
    try {
      return await this.primary.generateVibeCheck(input);
    } catch (error) {
      if (!this.secondary) {
        throw error;
      }
      return this.secondary.generateVibeCheck(input);
    }
  }

  async generatePairContent(input: { profileA: string; profileB: string }): Promise<{ synergyPoints: [string, string]; confessionPrompt: string }> {
    try {
      return await this.primary.generatePairContent(input);
    } catch (error) {
      if (!this.secondary) {
        throw error;
      }
      return this.secondary.generatePairContent(input);
    }
  }
}
