// Small array helpers.

// Remove null and undefined entries, returning a new array.
export function compact(arr) {
  return arr.filter((x) => x != null);
}
