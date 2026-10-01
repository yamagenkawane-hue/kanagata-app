import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATE_NAMES, availablePlates, validatePlate } from "../../src/domain/plates.ts";
import type { BomItem } from "../../src/domain/planning.ts";
const plate = (id: string, productId: string, name: string, archived = false): BomItem => ({ id, productId, name, kind: "plate", quantity: 1, notes: "", processes: ["machining","grinding","wire","assembly","trial"], archived });
test("plate options exclude used plates per mold and keep either duplicate row editable", () => {
  const items = [plate("a","m1",PLATE_NAMES[0]),plate("b","m1",PLATE_NAMES[0]),plate("c","m1",PLATE_NAMES[1]),plate("d","m2",PLATE_NAMES[2]),plate("e","m1",PLATE_NAMES[3],true)];
  assert.equal(availablePlates(items,"m1").length,8);
  assert.ok(availablePlates(items,"m1").includes(PLATE_NAMES[2]));
  assert.ok(availablePlates(items,"m1").includes(PLATE_NAMES[3]));
  for(const id of ["a","b"]){
    assert.ok(availablePlates(items,"m1",id).includes(PLATE_NAMES[0]));
    assert.doesNotThrow(()=>validatePlate(items,{...items[0],id}));
    assert.doesNotThrow(()=>validatePlate(items,{...items[0],id,name:PLATE_NAMES[4]}));
    assert.throws(()=>validatePlate(items,{...items[0],id,name:PLATE_NAMES[1]}),/登録済み/);
  }
  assert.throws(()=>validatePlate(items,{productId:"m1",name:PLATE_NAMES[0],kind:"plate"}),/登録済み/);
  assert.throws(()=>validatePlate(items,{productId:"m1",name:"不正名称",kind:"plate"}),/一覧/);
  assert.doesNotThrow(()=>validatePlate(items,{productId:"m1",name:"自由部品",kind:"part"}));
});
