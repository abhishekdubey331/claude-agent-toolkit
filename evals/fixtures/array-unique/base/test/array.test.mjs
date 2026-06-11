import test from "node:test";
import assert from "node:assert/strict";
import { unique, compact } from "../src/array.js";

test("compact still removes null and undefined", () => {
  assert.deepEqual(compact([1, null, 2, undefined, 3]), [1, 2, 3]);
});

test("unique removes duplicates, first occurrence wins", () => {
  assert.deepEqual(unique([1, 2, 2, 3, 1]), [1, 2, 3]);
});

test("unique preserves order of first occurrences", () => {
  assert.deepEqual(unique(["b", "a", "b", "c", "a"]), ["b", "a", "c"]);
});

test("unique does not mutate its input", () => {
  const input = [1, 1, 2];
  unique(input);
  assert.deepEqual(input, [1, 1, 2]);
});
