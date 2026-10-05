import test from "node:test";
import assert from "node:assert/strict";
import { enteredDuration, validDuration } from "../../src/domain/duration.ts";
import { createDemo } from "../../src/domain/demo.ts";
import { at, placeAtRequestedStart } from "../../src/domain/planning.ts";

test("型組・トライは整数日数、加工は30分単位", () => {
  assert.equal(enteredDuration("assembly", 1), 470);
  assert.equal(enteredDuration("trial", 2), 940);
  for (const value of [0, -1, 1.5]) assert.throws(() => enteredDuration("assembly", value));
  assert.equal(enteredDuration("wire", 90), 90);
  assert.throws(() => enteredDuration("wire", 470));
  assert.equal(validDuration("assembly", 470), true);
  assert.equal(validDuration("assembly", 60), true);
  assert.equal(validDuration("wire", 470), false);
});

test("1日で17:40終了、2日は会社休日を除いて翌稼働日まで", () => {
  const data = createDemo();
  const task = { ...data.tasks.find(t => t.process === "assembly")!, duration: 470, earliestStart: at("2026-10-02", 530), breakRun: false, overnight: false };
  assert.equal(placeAtRequestedStart(task, data.calendar).plannedEnd, at("2026-10-02", 1060));
  assert.equal(placeAtRequestedStart({ ...task, duration: 940 }, data.calendar).plannedEnd, at("2026-10-05", 1060));
});
