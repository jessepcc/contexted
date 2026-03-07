import type { AppConfig } from './dependencies.js';

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    maxUploadMb: toInt(env.MAX_UPLOAD_MB, 64),
    signedUploadTtlSec: toInt(env.SIGNED_UPLOAD_TTL_SEC, 300),
    rawHardTtlMinutes: toInt(env.RAW_HARD_TTL_MINUTES, 60),
    rawPolicyVersion: env.RAW_POLICY_VERSION ?? 'raw-v1',
    rawModeDefault: env.RAW_MODE_DEFAULT ?? 'ttl_object_storage',
    chatPollForegroundSec: toInt(env.CHAT_POLL_FOREGROUND_SEC, 5),
    chatPollBackgroundSec: toInt(env.CHAT_POLL_BACKGROUND_SEC, 30),
    processingPollMs: toInt(env.PROCESSING_POLL_MS, 2000),
    maxJsonBodyBytes: toInt(env.MAX_JSON_BODY_BYTES, 128 * 1024)
  };
}
