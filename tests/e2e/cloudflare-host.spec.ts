import {test,expect} from "@playwright/test";

test("Cloudflare reports declared backend readiness and hides deployment configuration",async({request})=>{
  test.skip(process.env.AGRISTORE_HOSTING_TARGET!=="cloudflare","Cloudflare-specific routing check.");
  const first=await request.get("/api/health");
  const configured=process.env.AGRISTORE_PREVIEW_BACKEND==="configured",expectedStatus=configured?200:503;
  expect(first.status()).toBe(expectedStatus);
  const body=await first.json();
  expect(body).toMatchObject({service:"agristore-pos",status:configured?"ok":"unavailable",version:1});
  expect(Date.now()-Date.parse(body.checkedAt)).toBeLessThan(30_000);
  expect(first.headers()["cache-control"]).toContain("no-store");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect((await request.head("/api/health")).status()).toBe(expectedStatus);
  expect((await request.post("/api/health")).status()).toBe(405);
  for(const path of ["/_worker.js","/_headers","/_routes.json","/.env","/app/page.tsx","/does-not-exist"]) expect((await request.get(path)).status(),path).toBe(404);
  const root=await request.get("/");expect(root.status()).toBe(200);expect(root.headers()["cache-control"]).toBe("no-cache");
  const sw=await request.get("/sw.js");expect(sw.status()).toBe(200);expect(sw.headers()["cache-control"]).toContain("no-store");
});
