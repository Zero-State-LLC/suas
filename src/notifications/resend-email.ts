/**
 * Resend adapter for the EMAIL capability port.
 *
 * Spec citations:
 * - SUAS-specs ARCHITECTURE.md §11 (`EmailPort`; vendor payloads stay adapter-local)
 * - SUAS-specs ARCHITECTURE.md §13 (finite outbound timeout)
 * - SUAS-specs NOTIFICATIONS.md §2 (do not fake delivery), §6 (`accepted` is not
 *   delivered), §10 (no message bodies or credentials in ordinary logs), §11
 *   (provider statuses must not leak into product contracts)
 * - SUAS-specs ENVIRONMENT.md §3 (`SUAS_EMAIL_MODE=resend`, D-004), §5
 *   (required secrets fail closed when this adapter is constructed), §6
 *   (email provider credentials are secrets)
 * - SUAS-specs AUTH.md §9 (challenge delivery uses this same EMAIL port)
 *
 * Official send API: HTTPS POST https://api.resend.com/emails
 * `createChannelRegistry` constructs this adapter only for the released mode.
 *
 * Failure mapping (suas #305): a 4xx other than 409 or 429 is a refusal a retry cannot fix,
 * so it settles now; 409, 429, 5xx and timeouts stay retryable with the same Idempotency-Key.
 */

import { fetchWithTimeout } from '../resilience/outbound-fetch.js';
import type { NotificationChannelPort, OutboundMessage, SendAcknowledgement } from './channels.js';
import { stagingRecipientAllowed, type RecipientAllowed } from './staging-recipients.js';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const RESEND_IDEMPOTENCY_KEY_MAX_LENGTH = 256;
export const RESEND_IMPLEMENTATION = 'resend' as const;

export type ResendSendOutcome = 'accepted' | 'not_accepted' | 'timeout' | 'recipient_not_allowed';

/** Structured send log. Never includes Authorization, API keys, or bodies. */
export interface ResendEmailLogRecord {
  readonly implementation: typeof RESEND_IMPLEMENTATION;
  readonly channel: 'EMAIL';
  readonly accepted: boolean;
  readonly outcome: ResendSendOutcome;
}

export type ResendEmailLogger = (record: ResendEmailLogRecord) => void;

export interface FetchTransport {
  fetch(url: string, init: RequestInit): Promise<Response>;
}

const defaultTransport: FetchTransport = {
  fetch(url, init) {
    return fetchWithTimeout(url, init);
  },
};

export interface ResendEmailChannelOptions {
  readonly apiKey: string;
  readonly fromAddress: string;
  readonly transport?: FetchTransport;
  readonly logger?: ResendEmailLogger;
  /** The STAGING last-hop allowlist (#306). Absent fails closed: only synthetic addresses. */
  readonly allowRecipient?: RecipientAllowed;
}

export class ResendEmailMisconfiguredError extends Error {
  readonly code = 'CONFIGURATION_INVALID';

  constructor(detail: string) {
    super(
      `Resend EmailPort is misconfigured: ${detail}. ` +
        `ENVIRONMENT.md §5 requires secrets for an enabled capability.`,
    );
    this.name = 'ResendEmailMisconfiguredError';
  }
}

/**
 * Fail closed unless both the API key and from address are present.
 * Construction fails closed unless both required configuration values exist.
 */
function requireConfigured(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === '') {
    throw new ResendEmailMisconfiguredError(`${label} is absent`);
  }
  return value;
}

export function createResendEmailChannel(
  options: Omit<ResendEmailChannelOptions, 'apiKey' | 'fromAddress'> & {
    readonly apiKey: string | undefined;
    readonly fromAddress: string | undefined;
  },
): ResendEmailChannel {
  const apiKey = requireConfigured(options.apiKey, 'RESEND_API_KEY');
  const fromAddress = requireConfigured(options.fromAddress, 'SUAS_EMAIL_FROM');
  return new ResendEmailChannel({ ...options, apiKey, fromAddress });
}

/**
 * Resend EMAIL port. `accepted` means Resend accepted the send attempt.
 * It does not mean the message was delivered (NOTIFICATIONS.md §6).
 */
export class ResendEmailChannel implements NotificationChannelPort {
  readonly channel = 'EMAIL' as const;
  readonly mode = RESEND_IMPLEMENTATION;
  readonly implementation = RESEND_IMPLEMENTATION;

  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly transport: FetchTransport;
  private readonly logger: ResendEmailLogger | undefined;
  private readonly allowRecipient: RecipientAllowed;

  constructor(options: ResendEmailChannelOptions) {
    this.apiKey = options.apiKey;
    this.fromAddress = options.fromAddress;
    this.transport = options.transport ?? defaultTransport;
    this.logger = options.logger;
    this.allowRecipient = options.allowRecipient ?? stagingRecipientAllowed(undefined);
  }

  async send(message: OutboundMessage): Promise<SendAcknowledgement> {
    if (message.channel !== 'EMAIL') {
      return this.finish('not_accepted');
    }
    if (
      message.idempotencyKey.length === 0 ||
      message.idempotencyKey.length > RESEND_IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      return this.finish('not_accepted');
    }
    if (
      message.subject === undefined ||
      message.subject.trim() === '' ||
      message.html === undefined ||
      message.html.trim() === ''
    ) {
      return this.finish('not_accepted');
    }
    // Before any call to Resend: an address off the list settles as not delivered, for good.
    if (!this.allowRecipient(message.destination)) {
      return this.finish('recipient_not_allowed', false);
    }

    try {
      const response = await this.transport.fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [message.destination],
          subject: message.subject,
          text: message.body,
          html: message.html,
        }),
      });

      const payload: unknown = await readJsonBody(response);
      if (hasProviderError(payload) || !response.ok) {
        return this.finish('not_accepted', !isPermanentRefusal(response.status));
      }

      const providerReference = providerId(payload);
      if (providerReference === undefined) {
        return this.finish('not_accepted');
      }

      this.emit('accepted');
      return { accepted: true, providerReference };
    } catch (error: unknown) {
      return this.finish(isTimeoutError(error) ? 'timeout' : 'not_accepted');
    }
  }

  private finish(
    outcome: Exclude<ResendSendOutcome, 'accepted'>,
    retryable = true,
  ): SendAcknowledgement {
    this.emit(outcome);
    return { accepted: false, ...(retryable ? {} : { retryable: false }), failureReason: outcome };
  }

  private emit(outcome: ResendSendOutcome): void {
    this.logger?.({
      implementation: RESEND_IMPLEMENTATION,
      channel: 'EMAIL',
      accepted: outcome === 'accepted',
      outcome,
    });
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function hasProviderError(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const error = (payload as { error?: unknown }).error;
  return error !== undefined && error !== null;
}

function providerId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const record = payload as { id?: unknown; data?: unknown };
  if (typeof record.id === 'string' && record.id.length > 0) return record.id;
  if (typeof record.data === 'object' && record.data !== null) {
    const id = (record.data as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return undefined;
}

/** 409 (idempotent request in flight) and 429 (rate limit) clear on their own. */
function isPermanentRefusal(status: number): boolean {
  return status >= 400 && status < 500 && status !== 409 && status !== 429;
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'TimeoutError' || name === 'AbortError';
}
