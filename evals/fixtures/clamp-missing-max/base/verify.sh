#!/bin/sh
# Oracle for this fixture: exit 0 iff acceptance tests pass.
# Run from the sandbox root (cwd = copied `base/`).
node --test test/*.test.mjs
