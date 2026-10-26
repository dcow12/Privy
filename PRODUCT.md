# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary viewers are hackathon judges watching a five-minute live demo on a projector at the UVA School of Data Science AI-safety hackathon ("Trust, but verify", Thrust I: The Boundary). The operator is a student researcher who sets up and runs experiments on a laptop and presents the results. Desktop only; phones are out of scope.

## Product Purpose

Privy tests whether an AI agent respects a safety rule because of the rule or because it can tell it is being watched. It runs paired experiments: the same request and the same safety policy, once in an environment that looks like a test sandbox and once in one that looks like production, then shows whether behaviour changes and whether the model said why. Success today is a demo where judges understand the finding within seconds.

## Positioning

Paired, cue-controlled scenarios: every condition varies one environment cue (host name, storage, users, emptiness, an explicit evaluation note, or a custom cue) while the task and policy stay fixed, so any difference is caused by the environment. It compares several real models from different providers side by side, and pairs behaviour with internal evidence (an evaluation-awareness probe on an open model's activations via NDIF).

## Operating Context

Run locally (`python app.py`, http://127.0.0.1:8000) on the presenter's laptop and shown on a projector. Four tabs: Keys, New experiment, Inside the model, Results. Results include plain-language findings, summary numbers, a dot-and-ring chart (sandbox vs production), a gap plot with 95% intervals, a "does it say it's being tested?" chart, transcripts, exports and a compare view.

## Capabilities and Constraints

- Providers: Anthropic, OpenAI, OpenRouter, Google Gemini, any OpenAI-compatible endpoint, and simulated agents for key-free demos. White-box runs on NDIF, a local model, or a simulated model.
- Up to 3 models per comparison.
- Must keep: all existing wording, the chart types, and the four-tab structure.
- Built for today's demo only; it does not need to scale beyond that.

## Brand Commitments

- Name: Privy. Tagline in use: "Does the agent respect the rule, or just the test?"
- Voice: honest about uncertainty; simulated data is always labelled as not a finding.

## Evidence on Hand

Simulated demo runs in `runs/`. No real-model results yet; never present simulated numbers as findings.

## Product Principles

1. The paired comparison is the point: show sandbox and production side by side.
2. Readable from the back of the room: contrast and size win over density.
3. Honest before impressive: label uncertainty and simulated data plainly.

## Accessibility & Inclusion

Projector legibility: high contrast and large type. Must not feel gimmicky, generic SaaS, hard to read, or like a hacker cliché.
