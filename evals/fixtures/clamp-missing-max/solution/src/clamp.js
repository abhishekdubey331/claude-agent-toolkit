// Constrain a number to an inclusive [min, max] range.
export function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
