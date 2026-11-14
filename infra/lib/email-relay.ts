/**
 * The email relay (suas #305): the one function that reaches Resend. The staging VPC has no
 * internet egress, so it runs outside the VPC, has no database access, and its role can read
 * only its own secret. The API and job worker invoke it with one rendered message
 * (src/aws/email-relay-lambda.ts).
 *
 * The secret is created here with a placeholder. The operator puts the Resend API key into it
 * by hand (see README); nothing in the template carries it.
 */

import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface EmailRelayProps {
  readonly code: lambda.Code;
  readonly logRetention: logs.RetentionDays;
  /** SUAS_EMAIL_FROM: the Resend sender, an operator setting with no default. */
  readonly fromAddress: string;
  /** SUAS_STAGING_FIXTURE_MAILBOX: the relay's own copy of the last-hop allowlist (r263 F2). */
  readonly fixtureMailbox: string;
}

export class EmailRelay extends Construct {
  readonly function: lambda.Function;
  readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: EmailRelayProps) {
    super(scope, id);

    // JSON `{"RESEND_API_KEY": "..."}`. The generated value fills an unused key, so the relay
    // answers "retryable" until the operator stores the real key.
    this.secret = new secretsmanager.Secret(this, 'ApiKey', {
      description: 'Resend API key for the email relay: {"RESEND_API_KEY"}. Set by hand.',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ RESEND_API_KEY: '' }),
        generateStringKey: 'placeholder',
        excludePunctuation: true,
      },
    });

    const logGroup = new logs.LogGroup(this, 'Logs', {
      retention: props.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // No managed policies and no VPC permissions: the role writes its log group and reads
    // its one secret, nothing else.
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    logGroup.grantWrite(role);
    this.secret.grantRead(role);

    this.function = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      code: props.code,
      handler: 'email-relay.handler',
      memorySize: 256,
      // Above the 10 s Resend request bound plus the secret read, below the callers' 28 s
      // invoke bound.
      timeout: Duration.seconds(25),
      role,
      logGroup,
      environment: {
        SUAS_EMAIL_SECRET_ID: this.secret.secretArn,
        SUAS_EMAIL_FROM: props.fromAddress,
        SUAS_STAGING_FIXTURE_MAILBOX: props.fixtureMailbox,
      },
    });
  }
}
