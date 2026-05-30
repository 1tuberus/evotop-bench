# evotop-bench

Free coding-model tournament (pass@1, hidden tests, sandboxed execution).

Runs weekly on a free GitHub-hosted runner ([RULE-GHA-FIRST]). Zero-dependency Node;
each candidate model generates a solution, the code is executed in an isolated Docker
container (`--network none`, memory/cpu/pid limits, hard timeout), and models are ranked
by tests-passed then latency. A result is published only after JSON validation, so a
failed or empty run never overwrites the last-good leaderboard.

- `bench/bench-run.mjs` — the tournament engine (zero-dep, Node ≥ 20).
- `.github/workflows/bench-tournament.yml` — weekly schedule + manual `workflow_dispatch`.

Cloud runs cover the HuggingFace-Router models (publicly reachable). The full set,
including localhost-only providers, runs separately on the host. No credentials live in
this repository — keys are injected at runtime from repository secrets.
