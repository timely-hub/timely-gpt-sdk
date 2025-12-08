import { evaluate, parse } from "@marcbachmann/cel-js";

export function evaluateCEL<T = any>(
  expression: string,
  context: Record<string, any>
): T {
  if (!expression || expression.trim() === "") {
    throw new Error("표현식이 비어있습니다");
  }

  try {
    parse(expression);
    return evaluate(expression, context) as T;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export function evaluateCondition(
  expression: string,
  context: Record<string, any>
): boolean {
  return Boolean(evaluateCEL<boolean>(expression, context));
}
