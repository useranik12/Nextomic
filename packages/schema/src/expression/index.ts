export { ExpressionError, parseExpression } from "./parse";
export { GLOBAL_FUNCTIONS, NAMESPACES, runExpression, toText } from "./evaluate";
export { kindOf, membersOf, type MemberDoc, type ValueKind } from "./methods";
export {
  COMPLETION_GROUP_ORDER,
  completeExpression,
  insideString,
  type Completion,
  type CompletionResult
} from "./completions";
export { expressionAtCaret, splitTemplate, type ExpressionPart } from "./template";
export { nowValues, ROOT_DOCS, typedGroup, typedValue, type TypedText } from "./scope";
export { expressionProblem, firstExpressionProblem } from "./check";
