import {describe,it,expect} from 'vitest';
import {supplierBookRequest} from '../../apps/web/lib/overview-account-requests';

describe('overview supplier balances',()=>{
 it('declares opening-balance support while preserving the business scope',()=>{
  expect(supplierBookRequest('test-organization','test-branch')).toEqual({organizationId:'test-organization',branchId:'test-branch',openingBalancesSupported:true});
 });
});
