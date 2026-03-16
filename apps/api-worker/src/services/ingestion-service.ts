import { piiRiskScoreFromReplacements, redactSensitiveText } from '@contexted/shared';
import type { AppDependencies } from '../dependencies.js';

export type ProcessIngestionInput = {
  jobId: string;
  sourceText?: string;
};

async function loadSourceText(deps: AppDependencies, storageKey: string): Promise<string> {
  const artifact = await deps.storageService.readArtifact(storageKey);

  if (typeof artifact === 'string') {
    return artifact;
  }

  if (artifact && typeof artifact === 'object') {
    const record = artifact as Record<string, unknown>;
    const candidates = [record.sourceText, record.summary_text, record.text];
    const text = candidates.find((value) => typeof value === 'string');
    if (typeof text === 'string') {
      return text;
    }
  }

  throw new Error('Source text unavailable for ingestion.');
}

export async function processIngestionJob(deps: AppDependencies, input: ProcessIngestionInput): Promise<void> {
  const now = deps.clock().toISOString();
  const job = await deps.repository.getIngestJobById(input.jobId);
  if (!job) {
    throw new Error(`Ingestion job ${input.jobId} was not found.`);
  }

  const ingestion = await deps.repository.getProfileIngestionById(job.ingestionId);
  if (!ingestion) {
    throw new Error(`Profile ingestion ${job.ingestionId} was not found.`);
  }

  await deps.repository.updateIngestJob(job.id, {
    state: 'processing',
    progress: 20,
    updatedAt: now
  });

  try {
    const sourceText =
      typeof input.sourceText === 'string' && input.sourceText.trim().length > 0
        ? input.sourceText
        : await loadSourceText(deps, ingestion.storageKey);
    const redactedMatchText = redactSensitiveText(sourceText);
    const matchText = redactedMatchText.text.trim();
    if (matchText.length === 0) {
      throw new Error('Match text is empty after redaction.');
    }

    const redacted = await deps.llmService.redactAndSummarize({
      sourceText: matchText,
      source: ingestion.source
    });

    const scrubbedSummary = redactSensitiveText(redacted.summary);

    await deps.repository.updateIngestJob(job.id, {
      progress: 55,
      updatedAt: deps.clock().toISOString()
    });

    const vibeCheck = await deps.llmService.generateVibeCheck({
      summary: scrubbedSummary.text,
      source: ingestion.source
    });

    const embedding = await deps.embeddingService.embed(matchText);

    await deps.repository.upsertProfile({
      userId: ingestion.userId,
      source: ingestion.source,
      matchText,
      sanitizedSummary: scrubbedSummary.text,
      vibeCheckCard: vibeCheck,
      embedding,
      embeddingModel: deps.config.embeddingModel,
      piiRiskScore: Math.max(
        redacted.piiRiskScore,
        piiRiskScoreFromReplacements(redactedMatchText.replacements),
        piiRiskScoreFromReplacements(scrubbedSummary.replacements)
      ),
      createdAt: now,
      updatedAt: deps.clock().toISOString()
    });

    console.info(
      `[ingest] completed job=${job.id} user=${ingestion.userId} matchChars=${matchText.length} summaryChars=${scrubbedSummary.text.length}`
    );

    await deps.repository.updateProfileIngestion(ingestion.id, {
      status: 'completed',
      rawDeletedAt: deps.clock().toISOString(),
      updatedAt: deps.clock().toISOString()
    });

    await deps.repository.setUserStatus(ingestion.userId, 'ready');
    await deps.repository.updateIngestJob(job.id, {
      state: 'succeeded',
      progress: 100,
      retryable: false,
      updatedAt: deps.clock().toISOString()
    });
  } catch (error) {
    await deps.repository.updateProfileIngestion(ingestion.id, {
      status: 'failed',
      errorCode: error instanceof Error ? error.message.slice(0, 100) : 'INGEST_FAILED',
      updatedAt: deps.clock().toISOString()
    });

    await deps.repository.setUserStatus(ingestion.userId, 'failed');
    await deps.repository.updateIngestJob(job.id, {
      state: 'failed',
      progress: 100,
      retryable: true,
      errorCode: error instanceof Error ? error.message.slice(0, 100) : 'INGEST_FAILED',
      updatedAt: deps.clock().toISOString()
    });

    throw error;
  }
}
