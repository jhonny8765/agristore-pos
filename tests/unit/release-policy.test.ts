import {describe,it,expect} from 'vitest';
import {releasePolicy,production} from '../../scripts/release-policy.mjs';
const sha='a'.repeat(40),valid=()=>({ref:'refs/heads/main',sha,head:sha,build:{sourceCommit:sha,configured:true,databaseMigration:'20261104020000'},confirmedMigration:'20261104020000',requiredMigration:'20261104020000',backend:production.backend});
describe('production release policy',()=>{
 it('allows only the verified current main package on the confirmed live database',()=>{expect(()=>releasePolicy(valid())).not.toThrow();});
 it('refuses an old commit, an unverified build or a different backend',()=>{for(const value of [{ref:'refs/heads/old'},{head:'b'.repeat(40)},{build:{...valid().build,sourceCommit:'b'.repeat(40)}},{build:{...valid().build,configured:false}},{backend:'https://other.supabase.co'}])expect(()=>releasePolicy({...valid(),...value})).toThrow();});
 it('blocks new database-dependent code until its migration is confirmed separately',()=>{expect(()=>releasePolicy({...valid(),requiredMigration:'20261105000000'})).toThrow('migrations');expect(()=>releasePolicy({...valid(),confirmedMigration:''})).toThrow('migrations');});
});
