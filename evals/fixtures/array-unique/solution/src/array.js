// Small array helpers.

// Remove null and undefined entries, returning a new array.
export function compact(arr) {
  return arr.filter((x) => x != null);
}

// Remove duplicate values, keeping the first occurrence and preserving order.
// Returns a new array; does not mutate the input.
export function unique(arr) {
  return [...new Set(arr)];
}
