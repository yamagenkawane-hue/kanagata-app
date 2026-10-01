import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedBody, sameOrigin } from "../../src/lib/business/http.ts";
test("HTTP origin permits the actual host and rejects external or malformed origins",()=>{const request=(origin:string)=>new Request("http://localhost:3000/api/business",{headers:{host:"127.0.0.1:3000",origin}});assert.ok(sameOrigin(request("http://127.0.0.1:3000")));assert.equal(sameOrigin(request("http://evil.example")),false);assert.equal(sameOrigin(request("invalid")),false);assert.equal(sameOrigin(request("https://127.0.0.1:3000")),false);});
test("HTTP body limits protect requests without content length",async()=>{assert.equal(new TextDecoder().decode(await boundedBody(new Request("http://localhost",{method:"POST",body:"abc"}),3)),"abc");await assert.rejects(()=>boundedBody(new Request("http://localhost",{method:"POST",body:"abcd"}),3),/大きすぎ/);});
