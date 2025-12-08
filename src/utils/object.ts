/**
 * Sets a value at a nested path in an object
 * @param obj - Target object
 * @param path - Dot-separated path (e.g., "a.b.c")
 * @param value - Value to set
 * @example
 * const obj = {};
 * setPath(obj, "a.b.c", 123);
 * // obj is now { a: { b: { c: 123 } } }
 */
export function setPath(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  const target = keys.reduce((acc, key) => {
    if (!(key in acc) || typeof acc[key] !== "object" || acc[key] === null) {
      acc[key] = {};
    }
    return acc[key];
  }, obj);

  target[lastKey] = value;
}
