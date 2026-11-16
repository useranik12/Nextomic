import { formProblems, type ElementNode } from "@nextomic/schema";

/** Refuses a tree whose forms nest, sit in a query loop, or have missing or repeated names. */
export function assertFormsValid(tree: ElementNode | undefined): void {
  const problem = tree ? formProblems(tree)[0] : undefined;
  if (!problem) return;
  const error = new Error(problem);
  error.name = "FormError";
  throw error;
}
