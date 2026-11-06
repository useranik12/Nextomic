import { describe, expect, it } from "vitest";
import { cssFileSchema, customCssFor, minifyCss, validateCssFile } from "./css-files";

const file = (over: Partial<ReturnType<typeof cssFileSchema.parse>>) =>
  cssFileSchema.parse({ id: "f", name: "File", css: "a{color:red}", ...over });

describe("custom CSS files", () => {
  it("validates syntax and blocks </style", () => {
    expect(validateCssFile("a{color:red}").ok).toBe(true);
    expect(validateCssFile("a{color:red").ok).toBe(false);
    expect(validateCssFile("a{}</style><script>").ok).toBe(false);
  });

  it("minifies without changing rules", () => {
    expect(
      minifyCss("/* x */\na {\n  color : red;\n}\n@media (min-width: 10px) {\n  b { margin: 0 }\n}")
    ).toBe("a{color:red}@media (min-width: 10px){b{margin:0}}");
  });

  it("keeps order, honors enabled and scope, skips broken files", () => {
    const files = [
      file({ id: "1", css: "a{x:1}" }),
      file({ id: "2", css: "b{x:2}", scope: "pages", pageIds: ["p1"] }),
      file({ id: "3", css: "c{x:3}", enabled: false }),
      file({ id: "4", css: "d{x:4" })
    ];
    expect(customCssFor(files, "p1")).toBe("a{x:1}\nb{x:2}");
    expect(customCssFor(files, "p2")).toBe("a{x:1}");
  });
});
