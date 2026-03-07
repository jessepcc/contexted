import type { AppDependencies } from '../dependencies.js';

export type ProcessIngestionInput = {
  jobId: string;
  sourceText: string;
};

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
    const redacted = await deps.llmService.redactAndSummarize({
      sourceText: input.sourceText,
      source: ingestion.source
    });

    await deps.repository.updateIngestJob(job.id, {
      progress: 55,
      updatedAt: deps.clock().toISOString()
    });

    const vibeCheck = await deps.llmService.generateVibeCheck({
      summary: redacted.summary,
      source: ingestion.source
    });

    const embedding = await deps.embeddingService.embed(redacted.summary);

    await deps.repository.upsertProfile({
      userId: ingestion.userId,
      source: ingestion.source,
      sanitizedSummary: redacted.summary,
      vibeCheckCard: vibeCheck,
      embedding,
      embeddingModel: 'text-embedding-3-small',
      piiRiskScore: redacted.piiRiskScore,
      createdAt: now,
      updatedAt: deps.clock().toISOString()
    });

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
