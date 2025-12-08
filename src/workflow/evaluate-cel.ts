import { evaluate, parse } from "@marcbachmann/cel-js";

/**
 * Converts BigInt values to numbers recursively
 */
function convertBigIntToNumber(value: any): any {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(convertBigIntToNumber);
  }
  if (value !== null && typeof value === "object") {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertBigIntToNumber(val);
    }
    return result;
  }
  return value;
}

export function evaluateCEL<T = any>(
  expression: string,
  context: Record<string, any>
): T {
  if (!expression || expression.trim() === "") {
    throw new Error("표현식이 비어있습니다");
  }

  try {
    parse(expression);
    const result = evaluate(expression, context);
    return convertBigIntToNumber(result) as T;
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
