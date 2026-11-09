import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { expressionProblem } from "./check";
import { completeExpression, insideString } from "./completions";
import { runExpression, toText } from "./evaluate";
import { expressionAtCaret, splitTemplate } from "./template";

const scope = {
  user: { name: "ann lee", email: "ann@example.com" },
  app: {
    count: 3,
    tags: ["b", "a", "b"],
    users: [
      { name: "Ann", age: 30 },
      { name: "Bo", age: 20 }
    ],
    since: DateTime.fromISO("2026-01-31T09:30:00Z", { setZone: true }),
    empty: null
  },
  $now: DateTime.fromISO("2026-11-07T10:00:00Z", { setZone: true })
};
const run = (source: string) => toText(runExpression(source, scope));

describe("expressions", () => {
  it("read names and nested values", () => {
    expect(run("user.name")).toBe("ann lee");
    expect(run("app.users[1].name")).toBe("Bo");
    expect(run("app.users.0.age")).toBe("30");
    expect(run("app.missing.deep")).toBe("");
    expect(run("app.empty?.name")).toBe("");
  });

  it("call string, number, list and date methods", () => {
    expect(run("user.name.toUpperCase()")).toBe("ANN LEE");
    expect(run("user.name.toTitleCase()")).toBe("Ann Lee");
    expect(run("user.email.split('@').first()")).toBe("ann");
    expect(run("(10 / 3).round(2)")).toBe("3.33");
    expect(run("1234.5.format('en-US')")).toBe("1,234.5");
    expect(run("app.tags.unique().sort().join(', ')")).toBe("a, b");
    expect(run("app.users.filter(u => u.age > 25).pluck('name')")).toBe('["Ann"]');
    expect(run("app.users.map(u => u.age).sum()")).toBe("50");
    expect(run("app.users.reduce((t, u) => t + u.age, 0)")).toBe("50");
    expect(run("app.since.toFormat('yyyy-MM-dd')")).toBe("2026-01-31");
    expect(run("app.since.plus(1, 'day').toISODate()")).toBe("2026-02-01");
    expect(run("'2026-03-01'.toDateTime().monthLong")).toBe("March");
    expect(run("$now.year")).toBe("2026");
  });

  it("support operators, conditions, templates and helpers", () => {
    expect(run("app.count > 2 ? 'many' : 'few'")).toBe("many");
    expect(run("app.empty ?? 'none'")).toBe("none");
    expect(run("'Hi ' + user.name")).toBe("Hi ann lee");
    expect(run("`${app.count} items`")).toBe("3 items");
    expect(run("$ifEmpty(app.empty, 'Guest')")).toBe("Guest");
    expect(run("Math.max(1, app.count)")).toBe("3");
    expect(run("JSON.stringify({ a: 1 })")).toBe('{"a":1}');
    expect(run("{ a: 1, b: 2 }.keys().length")).toBe("2");
  });

  it("never reaches prototypes, globals or host objects", () => {
    expect(run("user.constructor")).toBe("");
    expect(run("user['__proto__']")).toBe("");
    expect(run("app.tags.constructor")).toBe("");
    expect(run("globalThis")).toBe("");
    expect(run("process")).toBe("");
    expect(() => runExpression("user.name.constructor('return 1')()", scope)).toThrow();
    expect(() => runExpression("new Date()", scope)).toThrow();
    expect(() => runExpression("eval('1')", scope)).toThrow();
    expect(() => runExpression("app.tags.push('x')", scope)).toThrow();
  });

  it("stop runaway work", () => {
    expect(() => runExpression("'xx'.repeat(100000)", scope)).toThrow(/too long/);
    expect(() =>
      runExpression(
        "[1,2,3,4,5,6,7,8,9,10].map(a => [1,2,3,4,5,6,7,8,9,10].map(b => [1,2,3,4,5,6,7,8,9,10].map(c => [1,2,3,4,5,6,7,8,9,10].map(d => [1,2,3,4,5,6,7,8,9,10].map(e => e)))))",
        scope
      )
    ).toThrow(/too many steps/);
  });

  it("report syntax errors", () => {
    expect(() => runExpression("user.", scope)).toThrow();
    expect(() => runExpression("a = 1", scope)).toThrow();
  });
});

describe("templates", () => {
  it("split text and expressions, with braces and quotes inside", () => {
    expect(splitTemplate("Hi {{ user.name }}!")).toEqual([
      "Hi ",
      { expr: "user.name", start: 3, end: 18 },
      "!"
    ]);
    const parts = splitTemplate("{{ { a: '}}' }.keys() }} end");
    expect(parts[0]).toMatchObject({ expr: "{ a: '}}' }.keys()" });
    expect(splitTemplate("open {{ never")).toEqual(["open {{ never"]);
  });

  it("find the expression at the caret", () => {
    const text = "Hi {{ user.na";
    expect(expressionAtCaret(text, text.length)).toEqual({ start: 5, source: " user.na" });
    expect(expressionAtCaret("Hi {{ a }} b", 12)).toBeNull();
    expect(expressionAtCaret("plain", 3)).toBeNull();
  });
});

describe("completions", () => {
  const labels = (source: string) => completeExpression(source, scope).items.map((i) => i.label);

  it("lists variables by group, then names and functions", () => {
    const items = completeExpression(" ", { ...scope, now: { year: "2026" } }).items;
    expect(items.map((i) => i.label)).toEqual(
      expect.arrayContaining(["user", "app.count", "$now", "Math", "$ifEmpty"])
    );
    expect(items.map((i) => i.label)).not.toContain("now");
    expect(items.find((i) => i.label === "app.count")?.group).toBe("App state");
    expect(items.find((i) => i.label === "$ifEmpty")?.group).toBe("Functions");
    const groups = [...new Set(items.map((i) => i.group))];
    expect(groups.indexOf("App state")).toBeLessThan(groups.indexOf("Functions"));
    expect(labels(" us")).toEqual(expect.arrayContaining(["app.users", "user"]));
  });

  it("suggests query loops by %name, then their item and index", () => {
    const inLoop = { ...scope, "%posts": { item: { title: "A" }, index: 0 } };
    const roots = completeExpression(" %po", inLoop);
    expect(roots.from).toBe(1);
    const loop = roots.items.find((i) => i.label === "%posts");
    expect(loop?.group).toBe("Query loops");
    expect(loop?.insert).toBe("%posts");
    const fields = completeExpression(" %posts.", inLoop).items.map((i) => i.label);
    expect(fields).toEqual(expect.arrayContaining(["item", "index"]));
    const row = completeExpression(" %posts.item.", inLoop).items.map((i) => i.label);
    expect(row).toContain("title");
  });

  it("suggests nothing inside a quoted string", () => {
    expect(labels(' $now.toFormat("dd MM y')).toEqual([]);
    expect(labels(" `a ${app.co")).toContain("count");
    expect(insideString("'a' + 'b")).toBe(true);
    expect(insideString("'a' + b")).toBe(false);
  });

  it("finds unknown names, undeclared variables and errors", () => {
    expect(expressionProblem("app.count + 1", scope)).toBeNull();
    expect(expressionProblem("app.users.map(u => u.name)", scope)).toBeNull();
    expect(expressionProblem("app.nope", scope)).toMatch(/Unknown app state variable "nope"/);
    expect(expressionProblem("foo.bar", scope)).toMatch(/Unknown name "foo"/);
    expect(expressionProblem("app.count +", scope)).toBeTruthy();
    expect(expressionProblem("app.tags.push(1)", scope)).toBeTruthy();
  });

  it("lists fields and methods after a dot, matching the value", () => {
    expect(labels(" user.")).toEqual(expect.arrayContaining(["name", "email", "keys"]));
    expect(labels(" user.name.toUp")).toEqual(["toUpperCase"]);
    expect(labels(" app.tags.")).toEqual(expect.arrayContaining(["join", "map", "length"]));
    expect(labels(" app.since.to")).toEqual(expect.arrayContaining(["toFormat", "toISO"]));
    expect(labels(" Math.ro")).toEqual(["round"]);
    const dateLabels = labels(" app.since.to");
    expect(dateLabels.indexOf("toFormat")).toBeLessThan(dateLabels.indexOf("startOf"));
  });

  it("uses declared types for empty values", () => {
    const result = completeExpression(" app.empty.", scope, {
      hints: { "app.empty": { type: "timestamptz", isList: false, ref: "" } }
    });
    expect(result.items.map((i) => i.label)).toContain("toFormat");
  });

  it("puts the caret inside parentheses for methods with arguments", () => {
    const item = completeExpression(" user.name.repl", scope).items.find(
      (i) => i.label === "replace"
    );
    expect(item).toMatchObject({ insert: "replace()", caret: 8 });
  });
});

describe("loop row fields", () => {
  it("lists a loop row's fields under their own heading", () => {
    const inLoop = { "%posts": { item: { title: "", views: 0 }, index: 0 } };
    const items = completeExpression(" %posts.item.", inLoop).items;
    expect(items.find((i) => i.label === "title")?.group).toBe("Loop row fields");
    expect(items.find((i) => i.label === "views")?.detail).toBe("number");
  });
});
