import fs from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {production as p,releasePolicy} from './release-policy.mjs';
if(process.env.CI!=='true'||process.platform!=='linux')throw Error('Production publishing runs only in GitHub Actions.');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build=JSON.parse(await fs.readFile('cloudflare-output/build-report.json','utf8'));
const migration=(await fs.readdir('supabase/migrations')).filter(f=>/^\d{14}.*\.sql$/.test(f)).sort().at(-1).slice(0,14);
const main=()=>execFileSync('gh',['api',`repos/${p.repository}/git/ref/heads/main`,'--jq','.object.sha'],{encoding:'utf8'}).trim();
releasePolicy({ref:process.env.GITHUB_REF,sha:process.env.GITHUB_SHA,head:main(),build,confirmedMigration:process.env.MAGPET_DATABASE_MIGRATION,requiredMigration:migration,backend:build.backend});
execFileSync('git',['merge-base','--is-ancestor',p.baseline,sha]);
if(!process.env.CLOUDFLARE_API_TOKEN||process.env.CLOUDFLARE_ACCOUNT_ID!==p.account)throw Error('The scoped production publishing credential is missing.');
const api=async(path,method='GET')=>{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${p.account}${path}`,{method,headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(30000)});const body=await response.json();if(!response.ok||!body.success)throw Error(`Cloudflare ${method} failed: ${JSON.stringify(body.errors)}`);return body.result;};
const project=()=>api(`/pages/projects/${p.project}`);
const prior=(await project()).canonical_deployment;
if(!prior?.id||prior.latest_stage?.status!=='success')throw Error('No healthy rollback deployment was found.');
const result={sourceCommit:sha,release:build.release,previousDeployment:prior.id,startedAt:new Date().toISOString()};
let uploaded=false,mine;
try{
 if(main()!==sha)throw Error('Main changed during preparation; refusing an older release.');
 const publish=spawnSync('npx',['wrangler','pages','deploy','cloudflare-output/site','--project-name',p.project,'--branch','main','--commit-hash',sha,'--commit-message',`Verified Better Yield ${sha.slice(0,12)}`,'--commit-dirty=false'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 uploaded=true;
 mine=(await project()).canonical_deployment;
 if(publish.status!==0)throw Error('Cloudflare upload did not finish successfully.');
 if(mine?.deployment_trigger?.metadata?.commit_hash!==sha||mine.latest_stage?.status!=='success')throw Error('Production deployment identity or status did not match.');
 const local=await fs.readFile('cloudflare-output/site/index.html'),hash=b=>createHash('sha256').update(b).digest('hex');
 let checked=false,last;
 for(let attempt=0;attempt<6;attempt++){
  try{
   const healthResponse=await fetch(`${p.origin}/api/health?release=${build.release}`,{cache:'no-store',signal:AbortSignal.timeout(15000)}),health=await healthResponse.json();
   const response=await fetch(`${p.origin}/?release=${build.release}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
   const identityResponse=await fetch(`${p.origin}/release.json?release=${build.release}`,{cache:'no-store',signal:AbortSignal.timeout(15000)}),identity=await identityResponse.json();
   if(healthResponse.status!==200||health.release!==build.release||!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(local)||identity.sourceCommit!==sha||identity.backend!==p.backend||identity.databaseMigration!==migration)throw Error('The live release has not matched the verified package.');
   result.deploymentId=mine.id;result.htmlSha256=hash(local);result.verified=true;checked=true;break;
  }catch(e){last=e;if(attempt<5)await new Promise(r=>setTimeout(r,5000));}
 }
 if(!checked)throw last;
}catch(error){
 result.error=error.message;
 if(uploaded){
  const current=(await project()).canonical_deployment;
  if(current?.deployment_trigger?.metadata?.commit_hash===sha&&current.id!==prior.id){await api(`/pages/projects/${p.project}/deployments/${prior.id}/rollback`,'POST');result.rolledBackTo=prior.id;}
  else result.rollbackSkipped='Production belongs to another deployment; no concurrent release was overwritten.';
 }
 throw error;
}finally{result.finishedAt=new Date().toISOString();await fs.writeFile('cloudflare-output/deployment-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
