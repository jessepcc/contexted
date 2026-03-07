export const VALIDATION_ERROR_CODES = [
  'INVALID_FORMAT',
  'OUT_OF_RANGE',
  'DISALLOWED_VALUE',
  'PAYLOAD_TOO_LARGE',
  'STATE_CONFLICT'
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export type ApiErrorPayload = {
  code: ValidationErrorCode;
  field?: string;
  message: string;
};

export class ApiValidationError extends Error {
  public readonly statusCode: number;
  public readonly payload: ApiErrorPayload;

  constructor(payload: ApiErrorPayload, statusCode = 422) {
    super(payload.message);
    this.name = 'ApiValidationError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}
