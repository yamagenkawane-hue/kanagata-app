import test from "node:test";
import assert from "node:assert/strict";
import {chartMinute,chartTime} from "../../src/domain/chart-time.ts";
test("22時から翌7時を折りたたみ、日跨ぎの表示とドラッグ位置を一致させる",()=>{
 const origin=Date.parse("2026-11-19T00:00:00+09:00");
 const at=(minute:number)=>origin+minute*60000;
 for(const minute of [1320,1380,1440,1830,1860])assert.equal(chartMinute(at(minute),origin),900);
 assert.equal(chartMinute(at(1920),origin)-chartMinute(at(1260),origin),120);
 for(const minute of [420,450,1290,1860,1890])assert.equal(chartTime(chartMinute(at(minute),origin),origin),at(minute));
});
