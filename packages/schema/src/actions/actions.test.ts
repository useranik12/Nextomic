import { describe, expect, it } from "vitest";
import {
  ACTION_CATEGORIES,
  ACTIONS,
  actionBlockSchema,
  actionDisabledReason,
  countEnabledActions,
  defaultParams,
  fieldBindable,
  flowIssues,
  flowNodeSchema,
  getAction,
  nodeOutputType,
  ownerFlowsSchema,
  recursiveBlocks,
  TRIGGERS,
  triggerProblem,
  triggersFor,
  visibleNames,
  type ActionBlock,
  type FlowCheckContext,
  type FlowNode,
  type ParamField,
  type TriggerFlow
} from "../index";

const ctx: FlowCheckContext = { owner: "element", elementType: "button", blocks: [] };

const action = (id: string, type: string, extra: Partial<FlowNode> = {}): FlowNode =>
  ({ id, kind: "action", type, params: {}, ...extra }) as FlowNode;

const flow = (nodes: FlowNode[], trigger = "click"): TriggerFlow => ({
  id: "f1",
  trigger,
  settings: {},
  nodes
});

const group = (n: number) => ({
  id: "g",
  match: "all" as const,
  items: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    kind: "value" as const,
    left: "{{ app.x }}",
    op: "equals" as const,
    right: "1"
  }))
});

describe("trigger catalog", () => {
  it("lists every trigger of the owner's list", () => {
    const labels = new Set(TRIGGERS.map((t) => t.label));
    for (const label of [
      "On Click",
      "On Double Click",
      "On Click And Hold",
      "On Secondary Click",
      "On Secondary Double Click",
      "On Secondary Click And Hold",
      "On Pinch Zoom Start",
      "On Pinch Zoom End",
      "On Pinch Zoom Update",
      "When Content Loaded",
      "When Comes To Viewport",
      "When Position Updated",
      "On Pull To Refresh",
      "On Swipe",
      "On Expanded Child",
      "On Video Played Length",
      "On Audio Load Error",
      "On Timer End",
      "On Rows Per Page Change",
      "On Toggled Off",
      "On Tab Change",
      "On Submit",
      "On Selected",
      "On Unchecked",
      "On Complete",
      "On Value Change",
      "On Bar Select",
      "On Count Change",
      "On Hover Start",
      "On Hover End",
      "On Focus",
      "On Blur",
      "When Leaves Viewport",
      "On Key Press",
      "Timer / Interval",
      "On Page Leave",
      "On Online",
      "On Offline"
    ]) {
      expect(labels.has(label), label).toBe(true);
    }
  });

  it("has unique ids and valid fields", () => {
    expect(new Set(TRIGGERS.map((t) => t.id)).size).toBe(TRIGGERS.length);
    for (const t of TRIGGERS) checkFields(t.id, t.fields ?? []);
  });

  it("offers each owner its triggers", () => {
    const heading = triggersFor("element", "heading").map((t) => t.id);
    expect(heading).toContain("click");
    expect(heading).not.toContain("keyPress");
    expect(heading).not.toContain("image.loaded");
    expect(triggersFor("element", "image").map((t) => t.id)).toContain("image.loaded");
    const page = triggersFor("page", "page").map((t) => t.id);
    expect(page).toEqual(expect.arrayContaining(["load", "keyPress", "timer", "offline"]));
    expect(page).not.toContain("section.pullToRefresh");
  });

  it("explains unusable triggers", () => {
    expect(triggerProblem("click", "element", "text")).toBeNull();
    expect(triggerProblem("keyPress", "element", "text")).toMatch(/not available/);
    expect(triggerProblem("video.played", "element", "video")).toMatch(/not built/);
    expect(triggerProblem("nope", "page", "page")).toBe("Unknown trigger.");
  });
});

function checkFields(owner: string, fields: readonly ParamField[]): void {
  const keys = fields.map((f) => f.key);
  expect(new Set(keys).size, `${owner} field keys`).toBe(keys.length);
  for (const f of fields) {
    if (f.kind === "select") {
      expect(f.options?.length, `${owner}.${f.key} options`).toBeGreaterThan(0);
      if (f.default !== undefined) {
        expect(
          f.options?.some((o) => o.value === f.default),
          `${owner}.${f.key} default`
        ).toBe(true);
      }
    }
    if (f.kind === "rows") {
      expect(f.columns?.length, `${owner}.${f.key} columns`).toBeGreaterThan(0);
      checkFields(`${owner}.${f.key}`, f.columns ?? []);
    }
    if (f.showIf) expect(keys, `${owner}.${f.key} showIf`).toContain(f.showIf.key);
  }
}

describe("action catalog", () => {
  it("lists the owner's actions", () => {
    const labels = new Set(ACTIONS.map((a) => a.label));
    for (const label of [
      "Navigate To",
      "Navigate Back",
      "Login",
      "Register",
      "Log Out",
      "Send Password Reset Email",
      "Update Password",
      "Update Email",
      "Update Phone",
      "Query Row(s)",
      "Insert Row(s)",
      "Upsert Row(s)",
      "Update Row(s)",
      "Delete Row(s)",
      "Refresh Supabase Query",
      "Upload File",
      "Download File",
      "Clear Uploaded File",
      "Delete File",
      "Call Supabase RPC",
      "Call API Endpoint",
      "Update App State",
      "Update Page State",
      "Rebuild Page",
      "Set Form Fields",
      "Reset Form Fields",
      "Clear Form Fields",
      "Validate Form",
      "Rebuild Component/Element",
      "Add Class",
      "Remove Class",
      "Toggle Class",
      "Set ID",
      "Remove ID",
      "Set Attribute",
      "Remove Attribute",
      "Set Text",
      "Show",
      "Dismiss",
      "Date/Time Picker",
      "Color Picker",
      "Scroll To",
      "Launch Map",
      "Control Table",
      "Control Slider",
      "Control Accordion",
      "Control Tab",
      "Control Timer",
      "Control Switch",
      "Control Swipeable Stack",
      "Start GSAP Timeline",
      "Stop GSAP Timeline",
      "Set Theme",
      "Set UI Mode (Light/Dark)",
      "Open Off Canvas",
      "Close Off Canvas",
      "Toggle Off Canvas",
      "Show Modal",
      "Close Modal",
      "Toggle Modal",
      "Show Tooltip",
      "Close Tooltip",
      "Toggle Tooltip",
      "Play Sound",
      "Stop Sound",
      "Show Toast",
      "Confirm Dialog",
      "Wait",
      "Copy To Clipboard",
      "Pick File(s)",
      "Put Data To Presigned S3 Storage",
      "Execute Custom Code",
      "Debug Log",
      "Share",
      "Launch URL",
      "Send Email",
      "Call Number",
      "Send SMS",
      "Start Slideshow",
      "Play Video",
      "Set Shuffle Mode",
      "Set Loop Option",
      "Play Audio",
      "Play Lottie Animation",
      "Stop Lottie Animation",
      "Semantic Announce"
    ]) {
      expect(labels.has(label), label).toBe(true);
    }
    expect(labels.has("Trigger Push Notification")).toBe(false);
  });

  it("has unique types, known categories and consistent fields", () => {
    expect(new Set(ACTIONS.map((a) => a.type)).size).toBe(ACTIONS.length);
    const categories = new Set<string>(ACTION_CATEGORIES.map((c) => c.id));
    for (const a of ACTIONS) {
      expect(categories.has(a.category), a.type).toBe(true);
      checkFields(a.type, a.fields);
      const keys = a.fields.map((f) => f.key);
      for (const key of a.summary ?? []) expect(keys, `${a.type} summary`).toContain(key);
      if (a.output?.refParam) expect(keys).toContain(a.output.refParam);
      if (typeof a.output?.list === "object") expect(keys).toContain(a.output.list.param);
      if (a.disabled) expect(a.fields).toHaveLength(0);
    }
  });

  it("disables actions that need unbuilt parts, with a reason", () => {
    expect(actionDisabledReason(getAction("video.play")!)).toMatch(/not built/);
    expect(actionDisabledReason(getAction("modal.show")!)).toMatch(/Phase 9/);
    expect(actionDisabledReason(getAction("customCode")!)).toMatch(/Phase 10/);
    expect(actionDisabledReason(getAction("class.add")!)).toBeNull();
  });

  it("keeps structure pickers out of dynamic data", () => {
    expect(fieldBindable({ kind: "element" })).toBe(false);
    expect(fieldBindable({ kind: "text" })).toBe(true);
    expect(fieldBindable({ kind: "select" })).toBe(true);
  });

  it("types outputs from params", () => {
    const query = action("q", "supabase.query", { params: { table: "posts", single: "true" } });
    expect(nodeOutputType(query, [])).toEqual({ type: "supabaseRow", isList: false, ref: "posts" });
    const many = action("q", "supabase.query", { params: { table: "posts" } });
    expect(nodeOutputType(many, [])?.isList).toBe(true);
    expect(nodeOutputType(action("w", "wait"), [])).toBeNull();
  });
});

describe("flow schema", () => {
  it("parses nested containers with defaults", () => {
    const node = flowNodeSchema.parse({
      id: "l",
      kind: "loop",
      mode: "forEach",
      list: "{{ app.items }}",
      nodes: [
        { id: "a", kind: "action", type: "wait" },
        { id: "b", kind: "break" }
      ]
    });
    expect(node).toMatchObject({ itemName: "item", maxIterations: 1000, start: "", step: "" });
    expect(node.kind === "loop" && node.nodes[0]).toMatchObject({ params: {} });
  });

  it("allows one flow per trigger", () => {
    expect(ownerFlowsSchema.safeParse([flow([]), { ...flow([]), id: "f2" }]).success).toBe(false);
  });

  it("validates Action Blocks", () => {
    const bad = actionBlockSchema.safeParse({
      id: "b",
      name: "Save",
      params: [
        { id: "p1", name: "row", type: "json" },
        { id: "p2", name: "row", type: "element" }
      ]
    });
    expect(bad.success).toBe(false);
  });
});

describe("flow issues", () => {
  it("flags undefined actions, missing params and unknown options", () => {
    const issues = flowIssues(
      flow([
        action("a", ""),
        action("b", "auth.login", { params: { method: "password", email: "x@y.z" } }),
        action("c", "toast", { params: { message: "Hi", type: "loud" } })
      ]),
      ctx
    );
    expect(issues.map((i) => [i.nodeId, i.message])).toEqual([
      ["a", "Not defined: choose an action."],
      ["b", "Password is required."],
      ["c", "Type has an unknown value."]
    ]);
  });

  it("checks only fields on screen", () => {
    const login = action("b", "auth.login", { params: { method: "oauth", provider: "github" } });
    expect(flowIssues(flow([login]), ctx)).toEqual([]);
  });

  it("checks rows, loops, break and names", () => {
    const issues = flowIssues(
      flow([
        action("u", "state.updateApp", { params: { updates: [{ variable: "", value: "1" }] } }),
        { id: "br", kind: "break" },
        {
          id: "l",
          kind: "loop",
          mode: "forEach",
          list: "",
          itemName: "x",
          maxIterations: 5,
          start: "",
          end: "",
          step: "",
          nodes: []
        },
        action("t1", "confirm", {
          params: { title: "Sure?" },
          outputName: "x"
        } as Partial<FlowNode>)
      ]),
      ctx
    );
    const messages = issues.map((i) => i.message);
    expect(messages).toContain("Updates is required.");
    expect(messages).toContain("Updates row 1: Variable is required.");
    expect(messages).toContain("Break works only inside a loop.");
    expect(messages).toContain("Choose the list to loop over.");
    expect(messages).toContain('The name "x" is already used in this flow.');
  });

  it("skips disabled nodes and flows, flags disabled actions and missing blocks", () => {
    expect(flowIssues(flow([action("a", "", { disabled: true })]), ctx)).toEqual([]);
    expect(flowIssues({ ...flow([action("a", "")]), disabled: true }, ctx)).toEqual([]);
    const issues = flowIssues(
      flow([action("v", "video.play"), { id: "k", kind: "block", blockId: "gone", params: {} }]),
      ctx
    );
    expect(issues.map((i) => i.nodeId)).toEqual(["v", "k"]);
  });

  it("flags triggers the owner cannot use and empty condition branches", () => {
    expect(flowIssues(flow([], "keyPress"), ctx)[0]?.message).toMatch(/not available/);
    const cond: FlowNode = {
      id: "c",
      kind: "condition",
      branches: [{ id: "b", group: group(0), nodes: [] }]
    };
    expect(flowIssues(flow([cond]), ctx)[0]?.message).toMatch(/at least one condition/);
  });
});

describe("visible names", () => {
  const nodes: FlowNode[] = [
    action("a", "confirm", { outputName: "ok" } as Partial<FlowNode>),
    {
      id: "c",
      kind: "condition",
      branches: [
        {
          id: "b",
          group: group(1),
          nodes: [action("in", "confirm", { outputName: "inner" } as Partial<FlowNode>)]
        }
      ]
    },
    {
      id: "p",
      kind: "parallel",
      lanes: [
        { id: "l1", nodes: [action("p1", "confirm", { outputName: "left" } as Partial<FlowNode>)] },
        { id: "l2", nodes: [action("p2", "wait")] }
      ]
    },
    {
      id: "loop",
      kind: "loop",
      mode: "forEach",
      list: "{{ app.items }}",
      itemName: "row",
      maxIterations: 10,
      start: "",
      end: "",
      step: "",
      nodes: [
        {
          id: "t",
          kind: "tryCatch",
          try: [],
          catch: [action("deep", "wait")],
          errorName: "err"
        }
      ]
    },
    action("last", "wait")
  ];
  const names = (id: string) => visibleNames(nodes, id)?.map((n) => n.name);

  it("shows earlier outputs, not those of skipped branches", () => {
    expect(names("a")).toEqual([]);
    expect(names("in")).toEqual(["ok"]);
    expect(names("p2")).toEqual(["ok"]);
    expect(names("last")).toEqual(["ok", "left"]);
  });

  it("adds loop items and caught errors inside", () => {
    expect(names("deep")).toEqual(["ok", "left", "row", "err"]);
    expect(visibleNames(nodes, "missing")).toBeNull();
  });

  it("counts enabled actions", () => {
    expect(countEnabledActions(nodes)).toBe(6);
    expect(countEnabledActions([{ ...nodes[1]!, disabled: true }])).toBe(0);
  });
});

describe("Action Blocks", () => {
  it("finds blocks that call themselves", () => {
    const block = (id: string, calls: string[]): ActionBlock => ({
      id,
      name: id,
      description: "",
      params: [],
      nodes: calls.map((c, i) => ({ id: `${id}${i}`, kind: "block", blockId: c, params: {} }))
    });
    const found = recursiveBlocks([block("a", ["b"]), block("b", ["a"]), block("c", ["a"])]);
    expect([...found].sort()).toEqual(["a", "b"]);
  });

  it("starts actions with field defaults", () => {
    expect(defaultParams(getAction("toast")!.fields)).toEqual({
      type: "default",
      position: "bottom-right",
      durationMs: "4000"
    });
    expect(defaultParams(getAction("state.updateApp")!.fields)).toEqual({ updates: [] });
  });
});

describe("flow storage inputs", () => {
  it("validates a flow save and drops elements without flows", async () => {
    const { saveFlowsInputSchema, compactFlows, savePageInputSchema } = await import("../index");
    const ok = saveFlowsInputSchema.safeParse({
      ownerKind: "page",
      ownerId: "p1",
      nodeId: "n1",
      baseVersion: null,
      flows: [flow([action("a", "wait")])]
    });
    expect(ok.success).toBe(true);
    expect(
      saveFlowsInputSchema.safeParse({
        ownerKind: "site",
        ownerId: "p",
        nodeId: "n",
        baseVersion: null,
        flows: []
      }).success
    ).toBe(false);
    expect(compactFlows({ a: [], b: [flow([])] })).toEqual({ b: [flow([])] });
    const page = savePageInputSchema.parse({ baseVersion: 1, flows: { n1: [flow([])] } });
    expect(page.flows?.n1).toHaveLength(1);
  });
});

describe("flow edits", () => {
  it("inserts, finds, moves, replaces and removes nodes in nested lists", async () => {
    const m = await import("../index");
    const loop = m.newFlowNode("loop");
    let nodes = m.insertFlowNode([], m.TOP_SLOT, 0, loop);
    nodes = m.insertFlowNode(nodes, { parent: loop.id, list: "nodes" }, 0, action("a", "wait"));
    nodes = m.insertFlowNode(nodes, { parent: loop.id, list: "nodes" }, 1, action("b", "wait"));
    expect(m.findFlowNode(nodes, "b")).toMatchObject({ index: 1, slot: { parent: loop.id } });
    nodes = m.moveFlowNode(nodes, "b", -1);
    expect(m.findFlowNode(nodes, "b")?.index).toBe(0);
    nodes = m.replaceFlowNode(nodes, action("b", "toast"));
    expect((m.findFlowNode(nodes, "b")?.node as { type: string }).type).toBe("toast");
    nodes = m.removeFlowNode(nodes, "a");
    expect(m.findFlowNode(nodes, "a")).toBeNull();
    expect(m.findFlowNode(nodes, "b")?.ancestors.map((n) => n.id)).toEqual([loop.id]);
  });

  it("gives copies new ids throughout", async () => {
    const m = await import("../index");
    const cond = m.newFlowNode("condition");
    const filled = m.insertFlowNode(
      [cond],
      { parent: cond.id, list: m.slotLists(cond)[0]!.list },
      0,
      action("x", "wait")
    );
    const copy = m.withFreshIds(filled[0]!);
    expect(copy.id).not.toBe(cond.id);
    expect(m.findFlowNode([copy], "x")).toBeNull();
    expect(m.countEnabledActions([copy])).toBe(1);
  });

  it("generates loop item names and renames them in copies", async () => {
    const m = await import("../index");
    expect(m.loopItemName("{{ app.products }}", "abc123")).toBe("loop_abc123_products");
    const loop = m.newFlowNode("loop");
    if (loop.kind !== "loop") throw new Error("not a loop");
    expect(m.loopNameCode(loop.itemName)).toMatch(/^[a-z0-9]{6}$/);
    loop.nodes = [
      { id: "t", kind: "action", type: "toast", params: { message: `{{ ${loop.itemName}.item }}` } }
    ];
    const copy = m.withFreshIds(loop);
    if (copy.kind !== "loop") throw new Error("not a loop");
    expect(copy.itemName).not.toBe(loop.itemName);
    expect(JSON.stringify(copy.nodes)).toContain(copy.itemName);
  });

  it("checks Supabase values against the saved columns", async () => {
    const m = await import("../index");
    const col = (name: string, nullable: boolean, hasDefault: boolean) => ({
      name,
      pgType: "text",
      type: "string" as const,
      isList: false,
      nullable,
      primaryKey: false,
      references: null,
      enumValues: null,
      hasDefault,
      description: null
    });
    const structure = {
      schemas: [
        {
          schema: "public",
          functions: [],
          tables: [
            {
              name: "todos",
              kind: "table" as const,
              description: null,
              operations: ["select", "insert", "update", "delete"] as (
                | "select"
                | "insert"
                | "update"
                | "delete"
              )[],
              columns: [
                col("id", false, true),
                col("title", false, false),
                col("note", true, false)
              ]
            }
          ]
        }
      ],
      buckets: []
    };
    const insert = (values: { column: string; value: string }[]) =>
      m.supabaseActionProblems("supabase.insert", { table: "todos", values }, structure);
    expect(insert([])).toEqual([expect.stringContaining('"title" is required')]);
    expect(insert([{ column: "title", value: "{{ x }}" }])).toEqual([]);
    expect(insert([{ column: "title", value: "" }])[0]).toContain("cannot be empty");
    expect(
      insert([
        { column: "title", value: "a" },
        { column: "nope", value: "b" }
      ])[0]
    ).toContain("not a column");
    expect(
      m.supabaseActionProblems("supabase.update", { table: "todos", values: [] }, structure)
    ).toEqual([]);
    expect(m.supabaseActionProblems("supabase.insert", { table: "gone" }, structure)[0]).toContain(
      "not in the saved"
    );
  });

  it("explains every available trigger", async () => {
    const m = await import("../index");
    const missing = m.TRIGGERS.filter((t) => !t.disabled && !t.description).map((t) => t.id);
    expect(missing).toEqual([]);
  });
});
