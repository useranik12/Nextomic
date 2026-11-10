import { SUPABASE_OPERATORS, SUPABASE_OPERATOR_LABELS } from "../query";
import type { ActionCategory, ActionDef } from "./catalog";
import type { FieldOption, ParamField } from "./fields";

// Catalog data, in picker order. See `catalog.ts` for the shape and the rules.

const opts = (pairs: readonly [string, string][]): FieldOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

const text = (key: string, label: string, extra: Partial<ParamField> = {}): ParamField => ({
  key,
  label,
  kind: "text",
  ...extra
});

const pairs = (key: string, label: string, extra: Partial<ParamField> = {}): ParamField => ({
  key,
  label,
  kind: "rows",
  columns: [text("name", "Name", { required: true }), text("value", "Value")],
  ...extra
});

const target = (extra: Partial<ParamField> = {}): ParamField => ({
  key: "element",
  label: "Element",
  kind: "element",
  selfWhenEmpty: true,
  help: "Leave empty for this element.",
  ...extra
});

const notBuilt = (name: string) => `The ${name} element is not built yet.`;
const POPUPS_LATER = "Popup templates (modal, drawer, bottom sheet) come in Phase 9.";

/** Listed, greyed actions: no fields until the element or phase they need exists. */
function later(
  category: ActionCategory,
  subcategory: string | undefined,
  reason: string,
  items: readonly [string, string][]
): ActionDef[] {
  return items.map(([type, label]) => ({
    type,
    label,
    category,
    ...(subcategory ? { subcategory } : {}),
    runs: "browser" as const,
    description: label,
    fields: [],
    disabled: reason
  }));
}

const REDIRECT = text("redirect", "Redirect after", {
  placeholder: "/account",
  help: "A path on this site; other addresses are refused."
});

const OAUTH_PROVIDERS = opts([
  ["google", "Google"],
  ["apple", "Apple"],
  ["github", "GitHub"],
  ["gitlab", "GitLab"],
  ["bitbucket", "Bitbucket"],
  ["azure", "Microsoft (Azure)"],
  ["facebook", "Facebook"],
  ["discord", "Discord"],
  ["linkedin_oidc", "LinkedIn"],
  ["twitter", "X (Twitter)"],
  ["slack_oidc", "Slack"],
  ["spotify", "Spotify"],
  ["twitch", "Twitch"],
  ["notion", "Notion"],
  ["figma", "Figma"],
  ["zoom", "Zoom"]
]);

const auth = (
  type: string,
  label: string,
  description: string,
  fields: ParamField[],
  withUser = false
): ActionDef => ({
  type: `auth.${type}`,
  label,
  category: "backend",
  subcategory: "Supabase Authentication",
  runs: "server",
  description,
  fields,
  ...(withUser ? { output: { type: "json" as const } } : {})
});

const AUTH_ACTIONS: ActionDef[] = [
  auth(
    "login",
    "Login",
    "Signs the visitor in; the session is kept in an httpOnly cookie.",
    [
      {
        key: "method",
        label: "Method",
        kind: "select",
        default: "password",
        options: opts([
          ["password", "Email and password"],
          ["oauth", "OAuth provider"],
          ["magicLink", "Magic link"],
          ["emailOtp", "One-time code by email"],
          ["phoneOtp", "One-time code by SMS"]
        ])
      },
      text("email", "Email", {
        required: true,
        showIf: { key: "method", in: ["password", "magicLink", "emailOtp"] }
      }),
      text("phone", "Phone", { required: true, showIf: { key: "method", in: ["phoneOtp"] } }),
      text("password", "Password", { required: true, showIf: { key: "method", in: ["password"] } }),
      {
        key: "provider",
        label: "Provider",
        kind: "select",
        required: true,
        options: OAUTH_PROVIDERS,
        showIf: { key: "method", in: ["oauth"] }
      },
      { ...REDIRECT, showIf: { key: "method", in: ["oauth", "magicLink"] } }
    ],
    true
  ),
  auth(
    "verifyOtp",
    "Verify One-Time Code",
    "Finishes a code login started by Login.",
    [
      {
        key: "channel",
        label: "Sent by",
        kind: "select",
        default: "email",
        options: opts([
          ["email", "Email"],
          ["phone", "SMS"]
        ])
      },
      text("email", "Email", { required: true, showIf: { key: "channel", in: ["email"] } }),
      text("phone", "Phone", { required: true, showIf: { key: "channel", in: ["phone"] } }),
      text("code", "Code", { required: true })
    ],
    true
  ),
  auth(
    "register",
    "Register",
    "Creates an account and signs the visitor in.",
    [
      text("email", "Email", { required: true }),
      text("password", "Password", { required: true }),
      pairs("metadata", "User metadata")
    ],
    true
  ),
  auth("logout", "Log Out", "Ends the session.", [REDIRECT]),
  auth(
    "sendPasswordReset",
    "Send Password Reset Email",
    "Sends a reset link; the result is the same whether or not the account exists.",
    [text("email", "Email", { required: true }), REDIRECT]
  ),
  auth("updatePassword", "Update Password", "Changes the signed-in user's password.", [
    text("password", "New password", { required: true })
  ]),
  auth("updateEmail", "Update Email", "Changes the email; the new address must be confirmed.", [
    text("email", "New email", { required: true })
  ]),
  auth("updatePhone", "Update Phone", "Changes the phone; the new number must be confirmed.", [
    text("phone", "New phone", { required: true })
  ]),
  auth(
    "updateUser",
    "Update User Metadata",
    "Changes fields of the user's metadata.",
    [pairs("metadata", "Metadata", { required: true })],
    true
  ),
  auth("resendVerification", "Resend Verification", "Sends the confirmation email again.", [
    text("email", "Email", { required: true })
  ])
];

const TABLE: ParamField = {
  key: "table",
  label: "Table",
  kind: "supabaseTable",
  required: true
};

const COLUMN: ParamField = {
  key: "column",
  label: "Column",
  kind: "supabaseColumn",
  tableParam: "table",
  required: true
};

const FILTERS = (required: boolean): ParamField => ({
  key: "filters",
  label: "Filters",
  kind: "rows",
  required,
  columns: [
    COLUMN,
    {
      key: "operator",
      label: "Operator",
      kind: "select",
      default: "eq",
      required: true,
      options: SUPABASE_OPERATORS.map((op) => ({ value: op, label: SUPABASE_OPERATOR_LABELS[op] }))
    },
    text("value", "Value")
  ]
});

const VALUES: ParamField = {
  key: "values",
  label: "Values",
  kind: "rows",
  required: true,
  columns: [COLUMN, text("value", "Value")]
};

const ROWS_OUT = { type: "supabaseRow" as const, list: true, refParam: "table" };

const supabase = (
  type: string,
  label: string,
  description: string,
  fields: ParamField[]
): ActionDef => ({
  type: `supabase.${type}`,
  label,
  category: "backend",
  subcategory: "Supabase",
  runs: "server",
  description,
  fields,
  output: ROWS_OUT,
  summary: ["table"]
});

const SUPABASE_ACTIONS: ActionDef[] = [
  {
    ...supabase("query", "Query Row(s)", "Reads rows from a table.", [
      { key: "single", label: "Single row", kind: "boolean", default: "false" },
      TABLE,
      {
        key: "select",
        label: "Columns",
        kind: "supabaseColumns",
        tableParam: "table",
        help: "None picked means every column."
      },
      FILTERS(false),
      {
        key: "order",
        label: "Order",
        kind: "rows",
        columns: [
          COLUMN,
          {
            key: "direction",
            label: "Direction",
            kind: "select",
            default: "asc",
            options: opts([
              ["asc", "Ascending"],
              ["desc", "Descending"]
            ])
          }
        ]
      },
      {
        key: "limit",
        label: "Limit",
        kind: "number",
        min: 1,
        max: 1000,
        showIf: { key: "single", in: ["false"] }
      }
    ]),
    output: { ...ROWS_OUT, list: { param: "single", when: "false" } }
  },
  supabase("insert", "Insert Row(s)", "Adds a row and returns it.", [TABLE, VALUES]),
  supabase("upsert", "Upsert Row(s)", "Adds a row or updates the one with the same key.", [
    TABLE,
    VALUES,
    {
      key: "onConflict",
      label: "Conflict columns",
      kind: "supabaseColumns",
      tableParam: "table",
      help: "None picked means the primary key."
    }
  ]),
  supabase("update", "Update Row(s)", "Changes the rows that match every filter.", [
    TABLE,
    VALUES,
    FILTERS(true)
  ]),
  supabase("delete", "Delete Row(s)", "Deletes the rows that match every filter.", [
    TABLE,
    FILTERS(true)
  ])
];

const BUCKET = text("bucket", "Bucket", { required: true });

const BACKEND_ACTIONS: ActionDef[] = [
  ...AUTH_ACTIONS,
  ...SUPABASE_ACTIONS,
  {
    type: "query.refresh",
    label: "Refresh Supabase Query",
    category: "backend",
    runs: "browser",
    description: "Runs a query loop of this page again and redraws its rows.",
    fields: [{ key: "query", label: "Query", kind: "query", required: true }],
    summary: ["query"]
  },
  {
    type: "file.upload",
    label: "Upload File",
    category: "backend",
    subcategory: "Supabase File",
    runs: "server",
    description: "Uploads files kept by Pick File(s) to a storage bucket.",
    fields: [
      BUCKET,
      text("path", "Folder path", { placeholder: "avatars/{{ user.id }}" }),
      text("files", "Files", { required: true, help: "The output of a Pick File(s) action." }),
      { key: "upsert", label: "Replace existing files", kind: "boolean", default: "false" }
    ],
    output: { type: "json", list: true },
    summary: ["bucket"]
  },
  {
    type: "file.download",
    label: "Download File",
    category: "backend",
    subcategory: "Supabase File",
    runs: "server",
    description: "Downloads a file from a storage bucket.",
    fields: [BUCKET, text("path", "File path", { required: true }), text("fileName", "Save as")],
    summary: ["path"]
  },
  {
    type: "file.clearLocal",
    label: "Clear Uploaded File",
    category: "backend",
    subcategory: "Supabase File",
    runs: "browser",
    description: "Forgets files kept in the browser by Pick File(s).",
    fields: [
      text("files", "Files", { required: true, help: "The output of a Pick File(s) action." })
    ]
  },
  {
    type: "file.delete",
    label: "Delete File",
    category: "backend",
    subcategory: "Supabase File",
    runs: "server",
    description: "Deletes files from a storage bucket.",
    fields: [
      BUCKET,
      text("paths", "File paths", { required: true, help: "One path, or a list of paths." })
    ],
    summary: ["paths"]
  },
  {
    type: "supabase.rpc",
    label: "Call Supabase RPC",
    category: "backend",
    subcategory: "Supabase RPC",
    runs: "server",
    description: "Calls a Postgres function.",
    fields: [text("function", "Function", { required: true }), pairs("args", "Arguments")],
    output: { type: "json" },
    summary: ["function"]
  },
  {
    type: "rest.call",
    label: "Call API Endpoint",
    category: "backend",
    subcategory: "API Data",
    runs: "server",
    description: "Runs a saved API Data call through the server; secrets stay on the server.",
    fields: [
      { key: "call", label: "API call", kind: "restCall", required: true },
      pairs("variables", "Variables")
    ],
    output: { type: "json" },
    summary: ["call"]
  }
];

const STATE_OPERATIONS = opts([
  ["set", "Set value"],
  ["reset", "Reset to initial value"],
  ["toggle", "Toggle (boolean)"],
  ["increment", "Increment by"],
  ["decrement", "Decrement by"],
  ["append", "Add to list"],
  ["prepend", "Add to start of list"],
  ["remove", "Remove from list"],
  ["removeAt", "Remove at index"],
  ["clear", "Clear"]
]);

const stateUpdates = (kind: "appState" | "pageState"): ParamField => ({
  key: "updates",
  label: "Updates",
  kind: "rows",
  required: true,
  columns: [
    { key: "variable", label: "Variable", kind, required: true },
    {
      key: "operation",
      label: "Operation",
      kind: "select",
      default: "set",
      required: true,
      options: STATE_OPERATIONS
    },
    text("value", "Value")
  ]
});

const FORMS_LATER = "Form elements come in Phase 7.";

const STATE_ACTIONS: ActionDef[] = [
  {
    type: "state.updateApp",
    label: "Update App State",
    category: "state",
    runs: "browser",
    description: "Changes app state variables; persisted ones are saved too.",
    fields: [stateUpdates("appState")]
  },
  {
    type: "state.updatePage",
    label: "Update Page State",
    category: "state",
    runs: "browser",
    description: "Changes page state variables.",
    fields: [stateUpdates("pageState")]
  },
  {
    type: "page.rebuild",
    label: "Rebuild Page",
    category: "state",
    runs: "browser",
    description:
      "Runs the page's queries again and redraws the page with its header and footer templates.",
    fields: []
  },
  ...later("state", "Form", FORMS_LATER, [
    ["form.set", "Set Form Fields"],
    ["form.reset", "Reset Form Fields"],
    ["form.clear", "Clear Form Fields"],
    ["form.validate", "Validate Form"]
  ]),
  {
    type: "element.rebuild",
    label: "Rebuild Component/Element",
    category: "state",
    runs: "browser",
    description: "Checks the conditions and loops of an element and its children again.",
    fields: [target({ selfWhenEmpty: false, help: undefined, required: true })],
    summary: ["element"]
  }
];

const ui = (
  type: string,
  label: string,
  description: string,
  fields: ParamField[],
  extra: Partial<ActionDef> = {}
): ActionDef => ({
  type,
  label,
  category: "ui",
  runs: "browser",
  description,
  fields,
  ...extra
});

const PROPS = { subcategory: "HTML/CSS Properties" };
const CLASS_NAME = text("className", "Class", { required: true, placeholder: "is-open" });
const ATTRIBUTE_NAME = text("name", "Attribute", { required: true, placeholder: "aria-expanded" });

const UI_ACTIONS: ActionDef[] = [
  ui("class.add", "Add Class", "Adds a class; class conditions update.", [target(), CLASS_NAME], {
    ...PROPS,
    summary: ["className"]
  }),
  ui("class.remove", "Remove Class", "Removes a class.", [target(), CLASS_NAME], {
    ...PROPS,
    summary: ["className"]
  }),
  ui(
    "class.toggle",
    "Toggle Class",
    "Adds the class, or removes it when present.",
    [target(), CLASS_NAME],
    { ...PROPS, summary: ["className"] }
  ),
  ui(
    "id.set",
    "Set ID",
    "Sets the element's HTML ID.",
    [target(), text("id", "ID", { required: true })],
    { ...PROPS, summary: ["id"] }
  ),
  ui("id.remove", "Remove ID", "Removes the element's HTML ID.", [target()], PROPS),
  ui(
    "attribute.set",
    "Set Attribute",
    "Sets an HTML attribute.",
    [target(), ATTRIBUTE_NAME, text("value", "Value")],
    { ...PROPS, summary: ["name"] }
  ),
  ui(
    "attribute.remove",
    "Remove Attribute",
    "Removes an HTML attribute.",
    [target(), ATTRIBUTE_NAME],
    { ...PROPS, summary: ["name"] }
  ),
  ui(
    "text.set",
    "Set Text",
    "Replaces the text of a heading, text or button.",
    [
      target({ elementTypes: ["heading", "text", "button"] }),
      { key: "text", label: "Text", kind: "textarea" }
    ],
    PROPS
  ),
  ...later("ui", "Bottom Sheet", POPUPS_LATER, [
    ["bottomSheet.show", "Show"],
    ["bottomSheet.dismiss", "Dismiss"]
  ]),
  ui(
    "picker.date",
    "Date/Time Picker",
    "Opens the browser's date or time picker and returns the choice.",
    [
      {
        key: "mode",
        label: "Pick",
        kind: "select",
        default: "date",
        options: opts([
          ["date", "Date"],
          ["time", "Time"],
          ["datetime", "Date and time"]
        ])
      },
      text("initial", "Initial value"),
      text("min", "Earliest"),
      text("max", "Latest")
    ],
    { output: { type: "timestamptz" } }
  ),
  ui(
    "picker.color",
    "Color Picker",
    "Opens a color picker and returns the color.",
    [{ key: "initial", label: "Initial color", kind: "color" }],
    { output: { type: "color" } }
  ),
  ui(
    "scrollTo",
    "Scroll To",
    "Scrolls the page to an element.",
    [
      target({ selfWhenEmpty: false, help: undefined, required: true }),
      {
        key: "position",
        label: "Align",
        kind: "select",
        default: "start",
        options: opts([
          ["start", "Top"],
          ["center", "Center"],
          ["end", "Bottom"]
        ])
      },
      { key: "offset", label: "Offset (px)", kind: "number", default: "0" },
      { key: "smooth", label: "Smooth", kind: "boolean", default: "true" }
    ],
    { summary: ["element"] }
  ),
  ui("launchMap", "Launch Map", "Opens a map app at an address or coordinates.", [
    {
      key: "mode",
      label: "Location",
      kind: "select",
      default: "address",
      options: opts([
        ["address", "Address"],
        ["coordinates", "Coordinates"]
      ])
    },
    text("address", "Address", { required: true, showIf: { key: "mode", in: ["address"] } }),
    text("latitude", "Latitude", { required: true, showIf: { key: "mode", in: ["coordinates"] } }),
    text("longitude", "Longitude", {
      required: true,
      showIf: { key: "mode", in: ["coordinates"] }
    }),
    {
      key: "provider",
      label: "Map",
      kind: "select",
      default: "google",
      options: opts([
        ["google", "Google Maps"],
        ["apple", "Apple Maps"],
        ["osm", "OpenStreetMap"]
      ])
    }
  ]),
  ...later("ui", undefined, notBuilt("Table"), [["control.table", "Control Table"]]),
  ...later("ui", undefined, notBuilt("Slider"), [["control.slider", "Control Slider"]]),
  ...later("ui", undefined, notBuilt("Accordion"), [["control.accordion", "Control Accordion"]]),
  ...later("ui", undefined, notBuilt("Tabs"), [["control.tabs", "Control Tab"]]),
  ...later("ui", undefined, notBuilt("Timer"), [["control.timer", "Control Timer"]]),
  ...later("ui", undefined, notBuilt("Switch"), [["control.switch", "Control Switch"]]),
  ...later("ui", undefined, notBuilt("Swipeable Stack"), [
    ["control.swipeableStack", "Control Swipeable Stack"]
  ]),
  ui(
    "gsap.start",
    "Start GSAP Timeline",
    "Plays a saved GSAP timeline.",
    [
      { key: "timeline", label: "Timeline", kind: "timeline", required: true },
      { key: "fromStart", label: "Restart from the beginning", kind: "boolean", default: "true" }
    ],
    { summary: ["timeline"] }
  ),
  ui(
    "gsap.stop",
    "Stop GSAP Timeline",
    "Pauses a GSAP timeline.",
    [
      { key: "timeline", label: "Timeline", kind: "timeline", required: true },
      { key: "reset", label: "Go back to the start", kind: "boolean", default: "false" }
    ],
    { summary: ["timeline"] }
  ),
  ui(
    "theme.set",
    "Set Theme",
    "Switches the site to another theme.",
    [{ key: "theme", label: "Theme", kind: "theme", required: true }],
    { summary: ["theme"] }
  ),
  ui(
    "uiMode.set",
    "Set UI Mode (Light/Dark)",
    "Switches between light and dark mode.",
    [
      {
        key: "mode",
        label: "Mode",
        kind: "select",
        default: "toggle",
        required: true,
        options: opts([
          ["light", "Light"],
          ["dark", "Dark"],
          ["system", "Follow the system"],
          ["toggle", "Toggle"]
        ])
      }
    ],
    { summary: ["mode"] }
  )
];

const ALERT_ACTIONS: ActionDef[] = [
  ...later("alerts", "Off Canvas", notBuilt("Off-canvas"), [
    ["offCanvas.open", "Open Off Canvas"],
    ["offCanvas.close", "Close Off Canvas"],
    ["offCanvas.toggle", "Toggle Off Canvas"]
  ]),
  ...later("alerts", "Modal", POPUPS_LATER, [
    ["modal.show", "Show Modal"],
    ["modal.close", "Close Modal"],
    ["modal.toggle", "Toggle Modal"]
  ]),
  ...later("alerts", "Tooltip", notBuilt("Tooltip"), [
    ["tooltip.show", "Show Tooltip"],
    ["tooltip.close", "Close Tooltip"],
    ["tooltip.toggle", "Toggle Tooltip"]
  ]),
  {
    type: "sound.play",
    label: "Play Sound",
    category: "alerts",
    subcategory: "Sound",
    runs: "browser",
    description: "Plays a sound file.",
    fields: [
      text("src", "Sound URL", { required: true }),
      { key: "volume", label: "Volume (%)", kind: "number", default: "100", min: 0, max: 100 },
      { key: "loop", label: "Loop", kind: "boolean", default: "false" }
    ],
    summary: ["src"]
  },
  {
    type: "sound.stop",
    label: "Stop Sound",
    category: "alerts",
    subcategory: "Sound",
    runs: "browser",
    description: "Stops a sound started by Play Sound, or every sound when empty.",
    fields: [text("src", "Sound URL")]
  },
  {
    type: "toast",
    label: "Show Toast",
    category: "alerts",
    runs: "browser",
    description: "Shows a short message that closes by itself.",
    fields: [
      text("message", "Message", { required: true }),
      {
        key: "tone",
        label: "Tone",
        kind: "select",
        default: "info",
        options: opts([
          ["info", "Info"],
          ["success", "Success"],
          ["warning", "Warning"],
          ["error", "Error"]
        ])
      },
      { key: "durationMs", label: "Duration (ms)", kind: "number", default: "4000", min: 1000 }
    ],
    summary: ["message"]
  },
  {
    type: "confirm",
    label: "Confirm Dialog",
    category: "alerts",
    runs: "browser",
    description: "Asks the visitor to confirm; returns true or false.",
    fields: [
      text("title", "Title", { required: true }),
      { key: "message", label: "Message", kind: "textarea" },
      text("confirmLabel", "Confirm button", { default: "Confirm" }),
      text("cancelLabel", "Cancel button", { default: "Cancel" }),
      { key: "danger", label: "Destructive", kind: "boolean", default: "false" }
    ],
    output: { type: "boolean" },
    summary: ["title"]
  }
];

const util = (
  type: string,
  label: string,
  description: string,
  fields: ParamField[],
  extra: Partial<ActionDef> = {}
): ActionDef => ({
  type,
  label,
  category: "utilities",
  runs: "browser",
  description,
  fields,
  ...extra
});

const UTILITY_ACTIONS: ActionDef[] = [
  util(
    "wait",
    "Wait",
    "Pauses the flow.",
    [
      {
        key: "durationMs",
        label: "Duration (ms)",
        kind: "number",
        default: "1000",
        min: 0,
        max: 600_000,
        required: true
      }
    ],
    { summary: ["durationMs"] }
  ),
  util("clipboard.copy", "Copy To Clipboard", "Copies text to the clipboard.", [
    { key: "text", label: "Text", kind: "textarea", required: true }
  ]),
  util(
    "files.pick",
    "Pick File(s)",
    "Lets the visitor choose files, then keeps them in the browser or uploads them to Supabase.",
    [
      { key: "multiple", label: "Multiple files", kind: "boolean", default: "false" },
      {
        key: "max",
        label: "At most",
        kind: "number",
        min: 1,
        max: 100,
        showIf: { key: "multiple", in: ["true"] }
      },
      text("accept", "Accepted types", { placeholder: "image/*,.pdf" }),
      { key: "maxSizeMb", label: "Max size per file (MB)", kind: "number", min: 1, max: 5000 },
      {
        key: "mode",
        label: "Then",
        kind: "select",
        default: "local",
        options: opts([
          ["local", "Store locally"],
          ["supabase", "Upload to Supabase"]
        ])
      },
      { ...BUCKET, showIf: { key: "mode", in: ["supabase"] } },
      text("path", "Folder path", { showIf: { key: "mode", in: ["supabase"] } })
    ],
    { output: { type: "json", list: { param: "multiple", when: "true" } } }
  ),
  util(
    "s3.put",
    "Put Data To Presigned S3 Storage",
    "Uploads a file to an S3-compatible presigned URL.",
    [
      text("url", "Presigned URL", { required: true }),
      text("file", "File", { required: true, help: "A file from Pick File(s)." }),
      text("contentType", "Content type"),
      {
        key: "method",
        label: "Method",
        kind: "select",
        default: "PUT",
        options: opts([
          ["PUT", "PUT"],
          ["POST", "POST"]
        ])
      }
    ],
    { output: { type: "json" } }
  ),
  ...later("utilities", undefined, "Custom code comes in Phase 10.", [
    ["customCode", "Execute Custom Code"]
  ]),
  util("debug.log", "Debug Log", "Writes to the browser console in preview and Test runs only.", [
    { key: "message", label: "Message", kind: "textarea", required: true },
    {
      key: "level",
      label: "Level",
      kind: "select",
      default: "log",
      options: opts([
        ["log", "Log"],
        ["info", "Info"],
        ["warn", "Warning"],
        ["error", "Error"]
      ])
    }
  ])
];

const share = (type: string, label: string, description: string, fields: ParamField[]) => ({
  type,
  label,
  category: "share" as const,
  runs: "browser" as const,
  description,
  fields
});

const SHARE_ACTIONS: ActionDef[] = [
  share("share", "Share", "Opens the device's share sheet.", [
    text("title", "Title"),
    { key: "text", label: "Text", kind: "textarea" },
    text("url", "URL")
  ]),
  share("launchUrl", "Launch URL", "Opens an address.", [
    text("url", "URL", { required: true }),
    { key: "newTab", label: "New tab", kind: "boolean", default: "false" }
  ]),
  share("mailto", "Send Email", "Opens the visitor's email app with a new message.", [
    text("to", "To", { required: true }),
    text("cc", "Cc"),
    text("bcc", "Bcc"),
    text("subject", "Subject"),
    { key: "body", label: "Body", kind: "textarea" }
  ]),
  share("tel", "Call Number", "Starts a phone call.", [
    text("number", "Number", { required: true })
  ]),
  share("sms", "Send SMS", "Opens the messages app with a new text.", [
    text("number", "Number", { required: true }),
    { key: "body", label: "Message", kind: "textarea" }
  ])
];

const PLAYER = (noun: string): [string, string][] => {
  const k = noun.toLowerCase();
  return [
    [`${k}.play`, `Play ${noun}`],
    [`${k}.pause`, `Pause ${noun}`],
    [`${k}.stop`, `Stop ${noun}`],
    [`${k}.step`, "Play Previous/Next In Playlist"],
    [`${k}.playlistAdd`, "Add To Playlist"],
    [`${k}.playlistRemove`, "Remove From Playlist"],
    [`${k}.shuffle`, "Set Shuffle Mode"],
    [`${k}.loop`, "Set Loop Option"]
  ];
};

const MEDIA_ACTIONS: ActionDef[] = [
  ...later("media", "Gallery", notBuilt("Gallery"), [["gallery.slideshow", "Start Slideshow"]]),
  ...later("media", "Video Player", notBuilt("Video"), PLAYER("Video")),
  ...later("media", "Audio Player", notBuilt("Audio"), PLAYER("Audio")),
  ...later("media", "Lottie", notBuilt("Lottie"), [
    ["lottie.play", "Play Lottie Animation"],
    ["lottie.pause", "Pause Lottie Animation"],
    ["lottie.stop", "Stop Lottie Animation"]
  ])
];

const ACCESSIBILITY_ACTIONS: ActionDef[] = [
  {
    type: "a11y.announce",
    label: "Semantic Announce",
    category: "accessibility",
    runs: "browser",
    description: "Reads a message aloud to screen reader users.",
    fields: [
      text("message", "Message", { required: true }),
      {
        key: "politeness",
        label: "Interrupt",
        kind: "select",
        default: "polite",
        options: opts([
          ["polite", "Wait for a pause"],
          ["assertive", "Interrupt now"]
        ])
      }
    ],
    summary: ["message"]
  }
];

export const ACTIONS: readonly ActionDef[] = [
  {
    type: "navigate",
    label: "Navigate To",
    category: "navigation",
    runs: "browser",
    description: "Opens a page of this site.",
    fields: [
      { key: "page", label: "Page", kind: "page", required: true, excludeCurrent: true },
      pairs("routeParams", "Route parameters"),
      pairs("query", "Query string"),
      { key: "replace", label: "Replace history entry", kind: "boolean", default: "false" }
    ],
    summary: ["page"]
  },
  {
    type: "navigateBack",
    label: "Navigate Back",
    category: "navigation",
    runs: "browser",
    description: "Goes back one page in the browser history.",
    fields: []
  },
  {
    type: "page.reload",
    label: "Reload Page",
    category: "navigation",
    runs: "browser",
    description: "Loads the current page again, after an optional delay.",
    fields: [
      {
        key: "delay",
        label: "Delay (ms)",
        kind: "number",
        default: "0",
        min: 0,
        max: 60000,
        help: "Waits this long before reloading."
      }
    ],
    summary: ["delay"]
  },
  ...BACKEND_ACTIONS,
  ...STATE_ACTIONS,
  ...UI_ACTIONS,
  ...ALERT_ACTIONS,
  ...UTILITY_ACTIONS,
  ...SHARE_ACTIONS,
  ...MEDIA_ACTIONS,
  ...ACCESSIBILITY_ACTIONS
];
