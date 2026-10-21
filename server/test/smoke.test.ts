import { strict as assert } from "node:assert";
import { test } from "node:test";

test("smoke", (): void => {
  assert.equal(1 + 1, 2);
});
