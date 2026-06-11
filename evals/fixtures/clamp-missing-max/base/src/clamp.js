// Constrain a number to an inclusive [min, max] range.
export function clamp(n, min, max) {
  if (n < min) return min;
  return n;
}
