import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Schemas } from '../../api/types';
import { paths } from '../../app/paths';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Dialog } from '../../components/Dialog';
import { TextArea } from '../../components/TextArea';
import { useSingleFlight } from '../../lib/single-flight';
import { uniqueBy } from '../../lib/unique-by';
import {
  useCaseServiceRequests,
  useCloseCase,
  useSupportCase,
  useWrapUpCase,
  type SettlementText,
} from './api';
import { allRequestsFinal, commandErrorMessage } from './case-logic';

/**
 * R11.1: a holder wraps up the Case once every request of it is final. Resolve records a
 * Settlement of four typed parts; Close is a separate, confirmed step.
 */
export function WrapUpCard({ caseId }: { caseId: string }) {
  const list = useCaseServiceRequests(caseId);
  const items = uniqueBy(
    list.data?.pages.flatMap((page) => page.service_requests) ?? [],
    (item) => item.service_request_id,
  );
  if (list.hasNextPage || !allRequestsFinal(items.map((item) => item.status))) return null;
  return <WrapUp caseId={caseId} />;
}

function WrapUp({ caseId }: { caseId: string }) {
  const status = useSupportCase(caseId).data?.status;
  if (status === 'RESOLVED') {
    return (
      <Shell>
        <CloseStep caseId={caseId} />
      </Shell>
    );
  }
  if (status === 'ASSIGNED' || status === 'ACTIVE' || status === 'FOLLOWUP') {
    return (
      <Shell>
        <SettlementForm caseId={caseId} status={status} />
      </Shell>
    );
  }
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <Card aria-labelledby="wrap-up" padding="lg" className="flex flex-col gap-4 max-sm:p-5">
      <h2 id="wrap-up" className="text-22 font-bold">
        Wrap up this case
      </h2>
      {children}
    </Card>
  );
}

const FIELDS: { name: keyof SettlementText; label: string }[] = [
  { name: 'requested', label: 'What was asked for' },
  { name: 'occurred', label: 'What happened' },
  { name: 'fulfilled', label: 'What was done' },
  { name: 'unresolved', label: 'Anything left undone' },
];

function SettlementForm({ caseId, status }: { caseId: string; status: Schemas['CaseStatus'] }) {
  const [text, setText] = useState<SettlementText>({
    requested: '',
    occurred: '',
    fulfilled: '',
    unresolved: '',
  });
  const wrapUp = useWrapUpCase(caseId);
  const flight = useSingleFlight();
  const settlement: SettlementText = {
    requested: text.requested.trim(),
    occurred: text.occurred.trim(),
    fulfilled: text.fulfilled.trim(),
    unresolved: text.unresolved.trim(),
  };
  const complete = Object.values(settlement).every((value) => value !== '');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete) return;
        flight(() => wrapUp.mutateAsync({ status, settlement }));
      }}
    >
      <p>Every request here is finished. Note what happened before you close the case.</p>
      {FIELDS.map((field) => (
        <TextArea
          key={field.name}
          label={field.label}
          rows={2}
          required
          value={text[field.name]}
          onChange={(event) => {
            setText({ ...text, [field.name]: event.target.value });
          }}
        />
      ))}
      {wrapUp.isError ? (
        <p role="alert" className="font-bold">
          {commandErrorMessage(wrapUp.error)}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={!complete || wrapUp.isPending}>
        {wrapUp.isPending ? 'Saving…' : 'Wrap up'}
      </Button>
    </form>
  );
}

function CloseStep({ caseId }: { caseId: string }) {
  const [confirming, setConfirming] = useState(false);
  const close = useCloseCase(caseId);
  const flight = useSingleFlight();
  const navigate = useNavigate();
  return (
    <>
      <p>This case is wrapped up. Close it when you are done.</p>
      <Button
        className="self-start"
        onClick={() => {
          setConfirming(true);
        }}
      >
        Close case
      </Button>
      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title="Close this case?"
      >
        <div className="flex flex-col gap-4">
          <p>Closing ends the chat and access for every helper on this case.</p>
          {close.isError ? (
            <p role="alert" className="font-bold">
              {commandErrorMessage(close.error)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={close.isPending}
              onClick={() => {
                flight(() =>
                  close.mutateAsync(undefined, { onSuccess: () => void navigate(paths.serve) }),
                );
              }}
            >
              {close.isPending ? 'Closing…' : 'Close case'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
