import { execFileSync } from "node:child_process";
if (process.env.CI !== "true")
  throw new Error(
    "This drill runs only on the disposable CI Supabase database.",
  );
const container = "supabase_db_agristore-pos",
  database = "agristore_restore_drill";
const run = (args, input) =>
  execFileSync(
    "docker",
    ["exec", ...(input ? ["-i"] : []), container, ...args],
    {
      input,
      encoding: "utf8",
      stdio: input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    },
  );
const seed = `
insert into auth.users(id,email) values('55000000-0000-4000-8000-000000000001','restore@example.invalid');
insert into auth.sessions(id,user_id) values('55000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001');
insert into public.organizations(id,name) values('55000000-0000-4000-8000-000000000002','CI restore fixture');
insert into public.branches(id,organization_id,name,code) values('55000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000002','Restore branch','RESTORE');
insert into public.staff_memberships(organization_id,user_id,role,name) values('55000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000001','owner','Restore owner');
insert into public.products(id,organization_id,name,sku,base_unit) values('55000000-0000-4000-8000-000000000004','55000000-0000-4000-8000-000000000002','Restore feeds','RESTORE-FEED','kg');
insert into public.inventory_movements(organization_id,branch_id,product_id,quantity,kind,source_id,created_by) values('55000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000003','55000000-0000-4000-8000-000000000004',14.5,'opening','55000000-0000-4000-8000-000000000005','55000000-0000-4000-8000-000000000001');
`;
run(
  ["psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  seed,
);
run([
  "pg_dump",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "--format=custom",
  "--file=/tmp/agristore-drill.dump",
]);
run(["createdb", "-U", "postgres", "--template=template0", database]);
try {
  // Keep the built-in public schema supplied by template0. Restore the complete
  // dump, including extension definitions, into this otherwise empty database.
  run([
    "pg_restore",
    "-U",
    "postgres",
    "--dbname=" + database,
    "--no-owner",
    "--exit-on-error",
    "/tmp/agristore-drill.dump",
  ]);
  const verify = `set role authenticated; select set_config('request.jwt.claims','{"sub":"55000000-0000-4000-8000-000000000001","session_id":"55000000-0000-4000-8000-000000000001","role":"authenticated"}',false); select public.agri_command('snapshot','{"organizationId":"55000000-0000-4000-8000-000000000002","branchId":"55000000-0000-4000-8000-000000000003","transactionIds":[]}')->'stocks'->0->>'quantity';`;
  const result = run(
    ["psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"],
    verify,
  );
  if (!result.includes("14.500000"))
    throw new Error(
      "Restored authorization, transaction API, or stock projection failed",
    );
  console.log(
    "Restore drill passed: schema, auth identities, permissions, journal, stock projection, and snapshot API.",
  );
} finally {
  run(["dropdb", "-U", "postgres", database]);
}
