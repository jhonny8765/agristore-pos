import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../apps/web/lib/api', () => ({ command: vi.fn() }));
import { command } from '../../apps/web/lib/api';
import { onlineOperation, pendingOperations, retryOperation } from '../../apps/web/lib/operations';
import { creditConfirmation, verifyCreditAcknowledgement } from '../../apps/web/lib/credit-confirmation';
import { sale, setupDB, uuid } from './fixtures';
import type { PosDatabase } from '@agristore/offline';

const data = { organizationId: uuid(1), branchId: uuid(2), requestId: uuid(91), clientId: uuid(81),
  total: 100000, cashReceived: 20000, expectedDueOn: '2026-12-04', term: 30,
  officialReference: 'book-091', items: sale().items };
const opened: PosDatabase[] = [];
afterEach(async () => { vi.resetAllMocks(); for (const db of opened.splice(0)) { db.close(); await db.delete(); } });

it('keeps the exact invoice amounts and due date from the original confirmed checkout', () => {
  verifyCreditAcknowledgement(data, { id: data.requestId, balance: 80000, dueOn: data.expectedDueOn, duplicate: false });
  const record = creditConfirmation(data, 'TEST farmer');
  expect(record).toMatchObject({ id: data.requestId, clientName: 'TEST farmer', total: 100000, cashReceived: 20000, balance: 80000, dueOn: '2026-12-04', officialReference: 'BOOK-091' });
  expect(record.items).toEqual(data.items);
  expect(record.items).not.toBe(data.items);
});

it('retains an uncertain request after a wrong identity, amount, date or incomplete acknowledgement', async () => {
  const db = await setupDB(); opened.push(db);
  for (const response of [ {}, { id: uuid(92), duplicate: true, sourceId: data.requestId },
    { id: data.requestId, duplicate: true, sourceId: uuid(92) },
    { id: data.requestId, duplicate: false, balance: 80001, dueOn: data.expectedDueOn },
    { id: data.requestId, duplicate: false, balance: 80000, dueOn: '2026-12-05' } ]) {
    vi.mocked(command).mockResolvedValueOnce(response);
    await expect(onlineOperation(db, uuid(4), 'record_credit_sale', data, 'requestId')).rejects.toThrow('could not be verified');
    expect((await pendingOperations(db))[0].data).toEqual(data);
  }
  vi.mocked(command).mockResolvedValueOnce({ id: data.requestId, sourceId: data.requestId, duplicate: true });
  await retryOperation(db, uuid(4), (await pendingOperations(db))[0]);
  expect(await pendingOperations(db)).toHaveLength(0);
  expect(vi.mocked(command).mock.calls.at(-1)).toEqual(['record_credit_sale', data]);
});
