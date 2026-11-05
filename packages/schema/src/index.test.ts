import assert from "node:assert/strict";
import test from "node:test";

import { storageDriverSchema, workspaceRoleSchema } from "./index";

test("workspace roles are intentionally constrained", () => {
  assert.equal(workspaceRoleSchema.safeParse("owner").success, true);
  assert.equal(workspaceRoleSchema.safeParse("superuser").success, false);
});

test("storage drivers are limited to supported platform adapters", () => {
  assert.deepEqual(storageDriverSchema.options, ["local", "s3"]);
});
