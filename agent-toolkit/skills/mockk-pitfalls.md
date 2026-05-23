---
name: mockk-pitfalls
description: Real-failure-driven catalogue of mockk gotchas that bite Kotlin/Android test authors — nullable-param matcher shadowing, Flow return wiring, coEvery overlap order, slot type pitfalls, dispatcher leaks. Use when writing or debugging tests that mock Kotlin interfaces with nullable params, suspend functions, Flow returns, or co-routines.
---

# mockk pitfalls

Concise catalogue of mockk gotchas I've personally watched eat author time. Each entry: the trap → the cheap symptom that surfaces it → the fix.

This is not a mockk tutorial. It's a "before you spend 10 minutes on a confused green test, check whether you hit one of these" reference.

---

## 1. `any<T>()` matches `null` on a nullable parameter

**Trap.** For a function `fun f(token: String?)`, the matcher `any<String>()` also matches `null`. If you stack two `coEvery` declarations — one for `null`, one for "any non-null" — the latter shadows the former and your test calls the wrong mock.

```kotlin
// WRONG — second declaration shadows the first for both null and non-null
coEvery { repo.f(null) } returns Result.success("a")
coEvery { repo.f(any<String>()) } returns Result.success("b")
// repo.f(null) now returns "b", not "a"
```

**Symptom.** A test whose first assertion expects "no token" behaviour fails with the "with token" branch's return value. Or worse: the first assertion accidentally passes because the wrong-branch return value happens to satisfy the assertion, and the test is silently wrong.

**Fix.** Use a literal or a typed nullable matcher:

```kotlin
// EITHER use the actual value the test will pass
coEvery { repo.f(null) } returns Result.success("a")
coEvery { repo.f("tok-1") } returns Result.success("b")

// OR use `match<T?>` with explicit type and an actual filter
coEvery { repo.f(match<String?> { it != null }) } returns Result.success("b")
```

The bare `match { it != null }` form fails to compile with "always true" because Kotlin infers `T : Any` — the explicit `<String?>` parameter is required when the underlying signature is nullable.

---

## 2. Suspend functions returning `Flow` need `flowOf(...)`, not `Result.success(...)`

**Trap.** If a repository exposes `val config: Flow<RemoteConfig>`, `coEvery { source.config } returns RemoteConfig(...)` looks reasonable but is wrong — the return type is `Flow<RemoteConfig>`, not `RemoteConfig`. Either you get a compile error (best case) or, if your mock returns `Any`, a `ClassCastException` at the first `.collect`.

**Fix.**

```kotlin
import kotlinx.coroutines.flow.flowOf
coEvery { source.config } returns flowOf(RemoteConfig(...))

// For multi-emission scenarios:
coEvery { source.config } returns flowOf(RemoteConfig(v1), RemoteConfig(v2))
```

For a `StateFlow` use `MutableStateFlow(initial).asStateFlow()` and capture the mutable reference if the test needs to push later emissions.

---

## 3. Overlapping `coEvery` declarations resolve in reverse-declaration order

**Trap.** mockk matches the most-recently-declared `coEvery` first when the argument matches multiple. Tests reading top-to-bottom assume the first declaration wins. They're wrong.

```kotlin
coEvery { repo.f("a") } returns 1   // declared first
coEvery { repo.f(any()) } returns 2 // declared second — wins for ALL inputs incl. "a"
// repo.f("a") returns 2, not 1
```

**Fix.** Declare specific matchers AFTER generic ones, or use literals throughout. If you need both a general fallback and a specific override, put the override second:

```kotlin
coEvery { repo.f(any()) } returns 2      // general fallback first
coEvery { repo.f("a") } returns 1        // specific override second — wins for "a"
```

This conflicts with the "intuitive" reading order but matches mockk's resolution semantics.

---

## 4. `slot<T>()` captures the LAST matching call only

**Trap.** `val s = slot<Foo>(); coEvery { x.f(capture(s)) } returns ...` — `s.captured` is whatever the LAST call passed. Tests that loop or fire multiple calls and assert on `s.captured` are reading the wrong call.

**Fix.** Use `mutableListOf<T>()` with `captureLambda` / `capture(list)` for multi-call assertions:

```kotlin
val calls = mutableListOf<Foo>()
coEvery { x.f(capture(calls)) } returns Unit
// after test:
assertEquals(3, calls.size)
assertEquals("first-call-arg", calls[0].name)
```

For single-call tests `slot` is fine — but only if you know it's single-call.

---

## 5. `relaxed = true` silently returns default values for non-stubbed methods

**Trap.** `mockk<Repo>(relaxed = true)` makes every un-stubbed method return a default (`null`, `0`, `false`, `Unit`, empty collection, etc.). If your test then calls a method you forgot to stub, the test passes with the default — which usually happens to satisfy assertions accidentally and hide a real bug.

**Symptom.** A test passes locally and on CI but the production VM crashes because it called a method whose mock returned `null` where the production VM returns a real object.

**Fix.** Use `relaxed = true` only on dependencies you don't care about. For the dependency under test, use the default `mockk<T>()` (strict) so unstubbed calls throw `MockKException` and surface the gap.

```kotlin
private val analytics: Analytics = mockk(relaxed = true)     // peripheral — fine
private val repo: Repository = mockk()                       // under test — strict
```

If you must use `relaxed = true` everywhere, periodically run tests with `mockk { every { repo.method(any()) } throws ... }` to catch silently-defaulted calls.

---

## 6. `MockKAnnotations.init(this)` + `@MockK` doesn't compose with `runTest`

**Trap.** Tests that combine `@MockK` annotation + `runTest { ... }` sometimes see the annotation-initialized mock NOT have `coEvery` stubs applied because the `runTest` block runs on a different dispatcher than `@Before` setup.

**Fix.** Initialize mocks directly in `@Before` with `mockk<T>(relaxed = ...)` (no annotation) so the construction is in the same thread as the test body. Annotations save 2 lines but cost half an hour debugging when this fires.

---

## 7. `Dispatchers.setMain(testDispatcher)` must be paired with `resetMain()` AND a per-test dispatcher

**Trap.** Sharing a single `StandardTestDispatcher` across the class and only calling `setMain` once doesn't isolate tests. A coroutine launched in test A that survives into test B (e.g. a `viewModelScope.launch` that wasn't cancelled) silently affects test B's scheduler state.

**Fix.** Standard pattern:

```kotlin
private val testDispatcher = StandardTestDispatcher()

@Before fun setUp() { Dispatchers.setMain(testDispatcher) }
@After fun tearDown() { Dispatchers.resetMain() }
```

For ViewModel tests, `viewModelScope` cancellation is handled by `ViewModel.onCleared()` — call `viewModel.cancel()` or recreate the VM per-test to avoid cross-test bleed.

---

## 8. `verify` order ≠ `coVerify` order; mixing them silently passes

**Trap.** `verify` matches non-suspend calls; `coVerify` matches suspend calls. If you `verify { suspendRepo.f() }` you get a confusing match-or-not depending on mockk version.

**Fix.** Use `coVerify` for any function that's `suspend` — even if you don't await it in the test:

```kotlin
coVerify(exactly = 1) { repo.suspendingMethod(any()) }
```

`verifyOrder { }` / `coVerifyOrder { }` for ordering assertions — order-of-declaration in `verify { ... }` is NOT order-asserting.

---

## When NOT to reach for this skill

- The test failure is a real assertion failure on a real bug — fix the bug, not the mock setup.
- The trap is a one-off you understand — keep the fix local.
- You're considering mocking the JVM standard library or your own data classes — that's usually a sign you're testing the wrong layer. Mock interfaces, not types.

---

## See also

- Kotlin coroutines `TestDispatcher` docs (for #7's full machinery).
- `code-simplification.md` boundary-check guard — overlapping mockk stubs are often a symptom of unclear boundary contracts.
