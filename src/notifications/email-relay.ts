/**
 * Wire contract of the outside-VPC email relay (suas #305). The API and job worker send one
 * rendered EMAIL message; the relay sends it through Resend and answers with the channel's
 * acknowledgement. snake_case JSON, like the job payloads.
 */

import { z } from 'zod';
import type { OutboundMessage, SendAcknowledgement } from './channels.js';
import { RESEND_IDEMPOTENCY_KEY_MAX_LENGTH } from './resend-email.js';

export const emailRelayRequestSchema = z
  .object({
    to: z.string().email(),
    template_version: z.string().min(1).max(128),
    subject: z.string().trim().min(1).max(998),
    text: z.string(),
    html: z.string().trim().min(1),
    idempotency_key: z.string().min(1).max(RESEND_IDEMPOTENCY_KEY_MAX_LENGTH),
  })
  .strict();
export type EmailRelayRequest = z.infer<typeof emailRelayRequestSchema>;

// Failure reasons are provider-neutral words (NOTIFICATIONS.md §11), safe to log.
export const emailRelayResponseSchema = z
  .object({
    accepted: z.boolean(),
    provider_reference: z.string().min(1).max(256).optional(),
    failure_reason: z
      .string()
      .regex(/^[a-z_]{1,64}$/)
      .optional(),
    retryable: z.literal(false).optional(),
  })
  .strict();
export type EmailRelayResponse = z.infer<typeof emailRelayResponseSchema>;

export function toRelayRequest(message: OutboundMessage): unknown {
  return {
    to: message.destination,
    template_version: message.templateVersion,
    subject: message.subject,
    text: message.body,
    html: message.html,
    idempotency_key: message.idempotencyKey,
  };
}

export function fromRelayRequest(request: EmailRelayRequest): OutboundMessage {
  return {
    channel: 'EMAIL',
    destination: request.to,
    templateVersion: request.template_version,
    subject: request.subject,
    body: request.text,
    html: request.html,
    idempotencyKey: request.idempotency_key,
  };
}

export function toRelayResponse(ack: SendAcknowledgement): EmailRelayResponse {
  return {
    accepted: ack.accepted,
    ...(ack.providerReference !== undefined ? { provider_reference: ack.providerReference } : {}),
    ...(ack.failureReason !== undefined ? { failure_reason: ack.failureReason } : {}),
    ...(ack.retryable === false ? { retryable: false as const } : {}),
  };
}

export function fromRelayResponse(response: EmailRelayResponse): SendAcknowledgement {
  return {
    accepted: response.accepted,
    ...(response.provider_reference !== undefined
      ? { providerReference: response.provider_reference }
      : {}),
    ...(response.failure_reason !== undefined ? { failureReason: response.failure_reason } : {}),
    ...(response.retryable === false ? { retryable: false } : {}),
  };
}
