import test from "node:test";
import assert from "node:assert/strict";
import { clamp } from "../src/clamp.js";

test("clamps below min up to min", () => {
  assert.equal(clamp(-1, 0, 10), 0);
});

test("clamps above max down to max", () => {
  assert.equal(clamp(20, 0, 10), 10);
});

test("passes values already in range through unchanged", () => {
  assert.equal(clamp(5, 0, 10), 5);
});
