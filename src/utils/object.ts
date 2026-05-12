const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Sets a value at a nested path in an object
 * @param obj - Target object
 * @param path - Dot-separated path (e.g., "a.b.c")
 * @param value - Value to set
 * @example
 * const obj = {};
 * setPath(obj, "a.b.c", 123);
 * // obj is now { a: { b: { c: 123 } } }
 * @throws if any path segment is "__proto__", "constructor", or "prototype"
 */
export function setPath(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Forbidden key in path: ${key}`);
    }
  }
  const lastKey = keys.pop()!;

  const target = keys.reduce((acc, key) => {
    if (
      !Object.prototype.hasOwnProperty.call(acc, key) ||
      typeof acc[key] !== "object" ||
      acc[key] === null
    ) {
      acc[key] = {};
    }
    return acc[key];
  }, obj);

  target[lastKey] = value;
}
