import { describe, expect, it } from "vitest";
import { FlowError } from "../flow/engine";
import { starterHandlers } from "../flow/handlers";
import type { FormRuntime } from "./form-runtime";

const calls: string[] = [];
const forms = {
  has: (name: string) => name === "signup",
  validate: () => ({ valid: false, errors: [{ field: "email", message: "x" }] }),
  set: (form: string, values: Record<string, string>) => {
    calls.push(`set ${form} ${JSON.stringify(values)}`);
    return [];
  },
  reset: (form: string) => (calls.push(`reset ${form}`), []),
  clear: (form: string) => (calls.push(`clear ${form}`), [])
} as unknown as FormRuntime;
const handlers = starterHandlers({
  forms,
  payload: { themes: [] },
  edits: {},
  navigation: {}
} as never);
const ctx = {} as never;
const run = async (type: string, params: Record<string, unknown>) =>
  (handlers[type] as (p: unknown, c: unknown) => unknown)(params, ctx);

describe("form actions", () => {
  it("validate answers whether every field passed", async () => {
    expect(await run("form.validate", { form: "signup" })).toBe(false);
  });
  it("set passes field values by name and skips blank names", async () => {
    await run("form.set", {
      form: "signup",
      values: [
        { name: "email", value: "a@b.co" },
        { name: " ", value: "ignored" }
      ]
    });
    expect(calls).toContain('set signup {"email":"a@b.co"}');
  });
  it("reset and clear act on the named form", async () => {
    await run("form.reset", { form: "signup" });
    await run("form.clear", { form: "signup" });
    expect(calls).toContain("reset signup");
    expect(calls).toContain("clear signup");
  });
  it("fails clearly when the form is missing or not named", async () => {
    await expect(run("form.clear", { form: "ghost" })).rejects.toBeInstanceOf(FlowError);
    await expect(run("form.validate", { form: "" })).rejects.toThrow("Choose the form.");
  });
});
