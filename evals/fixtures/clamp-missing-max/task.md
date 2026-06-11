clamp(n, min, max) should constrain n to the inclusive range [min, max].

Right now values above `max` pass through unchanged — `clamp(20, 0, 10)` returns `20` instead of `10`. Fix `clamp` in `src/clamp.js` so it returns `max` when `n` exceeds `max`, without changing the below-min or in-range behavior. There is already a test that pins the expected behavior.
