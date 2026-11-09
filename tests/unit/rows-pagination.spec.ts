import { describe, expect, it } from "vitest";
import { rows } from "../../apps/web/lib/api";

describe("owner workspace record preview pagination", () => {
  function clientStub() {
    const calls:string[]=[];
    const query={
      select(fields:string){calls.push("select:"+fields);return this;},
      eq(field:string,value:string){calls.push("eq:"+field+":"+value);return this;},
      order(field:string){calls.push("order:"+field);return this;},
      limit(amount:number){calls.push("limit:"+amount);return Promise.resolve({data:[{id:"newest"}],error:null});},
      range(start:number,end:number){calls.push("range:"+start+":"+end);return Promise.resolve({data:[{id:"older"}],error:null});},
    };
    const client={from(table:string){calls.push("from:"+table);return query;}} as unknown as Parameters<typeof rows>[3];
    return {client,calls};
  }

  it("keeps the original bounded first page and stable order", async()=>{
    const {client,calls}=clientStub();
    await expect(rows("audit_events","store-a",undefined,client)).resolves.toEqual([{id:"newest"}]);
    expect(calls).toContain("limit:1000");
    expect(calls).toContain("order:created_at");
    expect(calls).toContain("order:id");
  });

  it("requests the next inclusive page without skipping the 1001st record",async()=>{
    const {client,calls}=clientStub();
    await expect(rows("audit_events","store-a",undefined,client,1000)).resolves.toEqual([{id:"older"}]);
    expect(calls).toContain("range:1000:1999");
    expect(calls).toContain("eq:organization_id:store-a");
  });

  it("rejects invalid offsets before fetching extra data",async()=>{
    const {client,calls}=clientStub();
    await expect(rows("audit_events","store-a",undefined,client,-1)).rejects.toThrow("Invalid record page");
    expect(calls.some(call=>call.startsWith("range:")||call.startsWith("limit:"))).toBe(false);
  });
});
