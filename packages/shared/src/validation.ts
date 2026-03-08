import { z } from 'zod';
import { GENDER_IDENTITY, SOURCE_KIND } from './enums.js';
import {
  assertSafeFileName,
  assertSha256Hex,
  hasDisallowedControlChars,
  normalizeEmail,
  normalizeText
} from './sanitization.js';

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.string().email().max(254, 'Email exceeds 254 characters.'));

const safeText = (min: number, max: number) =>
  z
    .string()
    .transform(normalizeText)
    .refine((value) => value.length >= min, `Must be at least ${min} characters.`)
    .refine((value) => value.length <= max, `Must be at most ${max} characters.`)
    .refine((value) => !hasDisallowedControlChars(value), 'Control characters are not allowed.');

const fileNameSchema = z
  .string()
  .transform(normalizeText)
  .refine((value) => value.length > 0 && value.length <= 255, 'Invalid file name length.')
  .superRefine((value, ctx) => {
    try {
      assertSafeFileName(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Invalid file name.'
      });
    }
  });

const sha256Schema = z.string().superRefine((value, ctx) => {
  try {
    assertSha256Hex(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid SHA-256.'
    });
  }
});

const genderSchema = z.enum(GENDER_IDENTITY);
const inviteCodeSchema = safeText(4, 32)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]+$/.test(value), 'Invite code must use letters and numbers only.');

export const magicLinkSchema = z
  .object({
    email: emailSchema,
    redirect_to: z.string().url().transform(normalizeText)
  })
  .strict();

export const uploadInitSchema = z
  .object({
    source: z.enum(SOURCE_KIND),
    file_name: fileNameSchema,
    file_size: z.number().int().positive(),
    sha256: sha256Schema
  })
  .strict();

export const uploadCompleteSchema = z
  .object({
    ingestion_id: z.string().uuid()
  })
  .strict();

export const intakeSummarySchema = z
  .object({
    summary_text: safeText(1, 12000),
    source: z.enum(SOURCE_KIND),
    provider_label: safeText(1, 120).optional()
  })
  .strict()
  .superRefine(({ source, provider_label }, ctx) => {
    if (source === 'both' && !provider_label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'provider_label is required when source is both.',
        path: ['provider_label']
      });
    }
  });

export const preferencesSchema = z
  .object({
    gender_identity: genderSchema,
    attracted_to: z.array(genderSchema).min(1),
    age_min: z.number().int().min(18).max(99),
    age_max: z.number().int().min(18).max(99)
  })
  .strict()
  .superRefine(({ age_min, age_max }, ctx) => {
    if (age_max < age_min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'age_max must be greater than or equal to age_min.',
        path: ['age_max']
      });
    }
  });

export const confessionSchema = z
  .object({
    answer: safeText(1, 600),
    expected_version: z.number().int().min(0)
  })
  .strict();

export const sendMessageSchema = z
  .object({
    client_message_id: safeText(1, 100),
    body: safeText(1, 2000)
  })
  .strict();

export const reportSchema = z
  .object({
    match_id: z.string().uuid(),
    reported_id: z.string().uuid(),
    reason: safeText(1, 500)
  })
  .strict();

export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5)
  })
  .strict();

export const triggerDropSchema = z
  .object({
    drop_id: z.string().uuid().optional(),
    mode: safeText(1, 32).optional()
  })
  .strict();

export const referralClaimSchema = z
  .object({
    invite_code: inviteCodeSchema
  })
  .strict();

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type UploadInitInput = z.infer<typeof uploadInitSchema>;
export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;
export type IntakeSummaryInput = z.infer<typeof intakeSummarySchema>;
export type TriggerDropInput = z.infer<typeof triggerDropSchema>;
export type ReferralClaimInput = z.infer<typeof referralClaimSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type ConfessionInput = z.infer<typeof confessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
