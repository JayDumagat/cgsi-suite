import assert from "node:assert/strict";
import { it } from "node:test";
import { mayAuthenticate } from "./employee.js";

it("allows authentication only while an employee is active", () => {
  assert.equal(mayAuthenticate("active"), true);
  assert.equal(mayAuthenticate("disabled"), false);
  assert.equal(mayAuthenticate("offboarded"), false);
});
