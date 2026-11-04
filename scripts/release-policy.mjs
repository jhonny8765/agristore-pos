export const production={account:'b7f2cf5b5c6cd82599ac2317cf7b7968',project:'betteryieldpos',origin:'https://better-yield-magpet-pos.pages.dev',repository:'jhonny8765/agristore-pos',baseline:'74cdddf',backend:'https://vbmnnouwmxcuibywdkjw.supabase.co'};
export function releasePolicy({ref,sha,head,build,confirmedMigration,requiredMigration,backend}){
 if(ref!=='refs/heads/main')throw Error('Production releases require main.');
 if(!/^[a-f0-9]{40}$/.test(sha??'')||sha!==head||build.sourceCommit!==sha)throw Error('The checked, built and current main commits must match.');
 if(!build.configured||backend!==production.backend)throw Error('The package must use the existing live Magpet backend.');
 if(!/^\d{14}$/.test(confirmedMigration??'')||confirmedMigration!==requiredMigration||build.databaseMigration!==requiredMigration)throw Error('Database migrations require separate confirmed deployment before the website can release.');
}
