/** DISPATCH.md §4, §14.7: a former helper cannot act after release and re-accept. */
import { describe, expect, it, vi } from 'vitest';
import {
  executeServiceRequestCommandInTx,
  NotRequestHolderError,
} from '../../src/coordination/requests.js';

describe('request holder at mutation time', () => {
  it('refuses a START authorized before another helper accepted the request', async () => {
    // The route saw helper A; the row acquired under FOR UPDATE now belongs to B.
    const row = {
      service_request_id: 'request',
      tenant_id: 'tenant',
      case_id: 'case',
      category: 'PEER_SUPPORT',
      status: 'ACCEPTED',
      details: {},
      created_by: 'requester',
      accepted_by_user_id: 'helper-B',
    };
    const tx = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ ...row, status: 'IN_PROGRESS' }],
          rowCount: 1,
        }),
    };

    await expect(
      executeServiceRequestCommandInTx(tx, {
        tenantId: 'tenant',
        serviceRequestId: 'request',
        command: 'START',
        actorId: 'helper-A',
        actorType: 'USER',
        requiredHolderUserId: 'helper-A',
        expectedStatus: 'ACCEPTED',
      }),
    ).rejects.toBeInstanceOf(NotRequestHolderError);
    expect(tx.query).toHaveBeenCalledTimes(1);
    expect(tx.query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
  });

  it('allows the currently authorized helper to start the request', async () => {
    const row = {
      service_request_id: 'request',
      tenant_id: 'tenant',
      case_id: 'case',
      category: 'PEER_SUPPORT',
      status: 'ACCEPTED',
      details: {},
      created_by: 'requester',
      accepted_by_user_id: 'helper-A',
    };
    const tx = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ ...row, status: 'IN_PROGRESS' }], rowCount: 1 }),
    };

    const updated = await executeServiceRequestCommandInTx(tx, {
      tenantId: 'tenant',
      serviceRequestId: 'request',
      command: 'START',
      actorId: 'helper-A',
      actorType: 'USER',
      requiredHolderUserId: 'helper-A',
      expectedStatus: 'ACCEPTED',
    });
    expect(updated.status).toBe('IN_PROGRESS');
    expect(tx.query).toHaveBeenCalledTimes(2);
  });
});
