/**
 * The `resend` EMAIL channel inside the VPC (suas #305). The staging VPC has no internet
 * egress, so the API and job worker hand one rendered message to the outside-VPC relay
 * function by Lambda Invoke; the relay alone holds the Resend key and the sender.
 *
 * Classification of a failed invoke (bb846415): if the relay may have run (a timeout waiting
 * for its answer, a lost connection, or the function itself erroring), the message may
 * already be out, so the result is an ambiguous acknowledgement. Only a known pre-execution
 * rejection is retryable. SDK retries are off: the job outbox owns retrying.
 */

import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { awsErrorName } from '../aws/errors.js';
import type { NotificationChannelPort, OutboundMessage, SendAcknowledgement } from './channels.js';
import {
  emailRelayRequestSchema,
  emailRelayResponseSchema,
  fromRelayResponse,
  toRelayRequest,
} from './email-relay.js';
import { RESEND_IMPLEMENTATION, ResendEmailMisconfiguredError } from './resend-email.js';
import type { RecipientAllowed } from './staging-recipients.js';

// These Invoke rejections occur before the function executes; transport loss is unknown.
const INVOKE_REJECTIONS: ReadonlySet<string> = new Set([
  'TooManyRequestsException',
  'AccessDeniedException',
  'ResourceNotFoundException',
  'InvalidParameterValueException',
  'InvalidRequestContentException',
  'RequestTooLargeException',
  'UnsupportedMediaTypeException',
]);

/** Above the relay's own 25 s function timeout, so the relay answers first. */
export const RELAY_INVOKE_TIMEOUT_MS = 28_000;

const AMBIGUOUS: SendAcknowledgement = {
  accepted: false,
  retryable: false,
  failureReason: 'relay_ambiguous_ack',
};

/** The one Lambda client method this channel uses; tests supply a fake. */
export interface LambdaClientLike {
  send(
    command: InvokeCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<InvokeCommandOutput>;
}

/** Structured send log. Never includes addresses, subjects, bodies or provider replies. */
export interface RelayEmailLogRecord {
  readonly implementation: typeof RESEND_IMPLEMENTATION;
  readonly channel: 'EMAIL';
  readonly via: 'relay';
  readonly accepted: boolean;
  readonly outcome: string;
}

export interface LambdaRelayEmailChannelOptions {
  readonly functionName: string;
  readonly region: string;
  /** The STAGING last-hop allowlist (#306), checked before any invoke. */
  readonly allowRecipient: RecipientAllowed;
  readonly client?: LambdaClientLike;
  readonly logger?: (record: RelayEmailLogRecord) => void;
}

/** Fail closed: the relay needs its region (config requires it beside the relay). */
export function createLambdaRelayEmailChannel(
  options: Omit<LambdaRelayEmailChannelOptions, 'region'> & { readonly region: string | undefined },
): LambdaRelayEmailChannel {
  const { region } = options;
  if (region === undefined || region.trim() === '') {
    throw new ResendEmailMisconfiguredError('SUAS_AWS_REGION is absent');
  }
  return new LambdaRelayEmailChannel({ ...options, region });
}

export class LambdaRelayEmailChannel implements NotificationChannelPort {
  readonly channel = 'EMAIL' as const;
  readonly mode = RESEND_IMPLEMENTATION;
  readonly implementation = RESEND_IMPLEMENTATION;

  private readonly client: LambdaClientLike;

  constructor(private readonly options: LambdaRelayEmailChannelOptions) {
    this.client = options.client ?? new LambdaClient({ region: options.region, maxAttempts: 1 });
  }

  async send(message: OutboundMessage): Promise<SendAcknowledgement> {
    const request = emailRelayRequestSchema.safeParse(toRelayRequest(message));
    if (message.channel !== 'EMAIL' || !request.success) {
      return this.finish({ accepted: false, retryable: false, failureReason: 'invalid_message' });
    }
    if (!this.options.allowRecipient(message.destination)) {
      return this.finish({
        accepted: false,
        retryable: false,
        failureReason: 'recipient_not_allowed',
      });
    }

    let output: InvokeCommandOutput;
    try {
      output = await this.client.send(
        new InvokeCommand({
          FunctionName: this.options.functionName,
          InvocationType: 'RequestResponse',
          Payload: new TextEncoder().encode(JSON.stringify(request.data)),
        }),
        { abortSignal: AbortSignal.timeout(RELAY_INVOKE_TIMEOUT_MS) },
      );
    } catch (error: unknown) {
      const name = awsErrorName(error);
      return this.finish(
        name !== undefined && INVOKE_REJECTIONS.has(name)
          ? { accepted: false, failureReason: 'relay_unavailable' }
          : AMBIGUOUS,
      );
    }

    // A function error (crash or relay timeout) can happen after Resend accepted the message.
    if (output.FunctionError !== undefined || output.Payload === undefined) {
      return this.finish(AMBIGUOUS);
    }
    const parsed = emailRelayResponseSchema.safeParse(parsePayload(output.Payload));
    return this.finish(parsed.success ? fromRelayResponse(parsed.data) : AMBIGUOUS);
  }

  private finish(ack: SendAcknowledgement): SendAcknowledgement {
    this.options.logger?.({
      implementation: RESEND_IMPLEMENTATION,
      channel: 'EMAIL',
      via: 'relay',
      accepted: ack.accepted,
      outcome: ack.accepted ? 'accepted' : (ack.failureReason ?? 'not_accepted'),
    });
    return ack;
  }
}

function parsePayload(payload: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return undefined;
  }
}
