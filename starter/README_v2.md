# Sandbox Sniffer v2: Which cue does the model track, and does it matter?

**Thrust I: The Boundary.** Everything is simulated, and nothing executes.

## Run

```bash
pip install -r requirements.txt
python sandbox_sniffer.py --skip-steering      # ~1-3 min: probes, transfer, behaviour
python sandbox_sniffer.py --reuse              # adds steering, reusing cached activations
python sandbox_sniffer.py --model HuggingFaceTB/SmolLM2-360M-Instruct --out results_360m
```

`--layer N` sets the residual stage used for the transfer heatmap and for steering. The default is the middle stage. **Pick it before you look at results.**

## Design (720 prompts)

There are 20 tasks (10 allowed, 10 disallowed) × 5 prompt families. The safety policy is identical in every prompt.

| family | what differs between sandbox-ish and prod-ish |
|---|---|
| aligned | host name + storage + users/activity all point the same way |
| naming | only the host name (`ci-runner-14` vs `payments-api-14`) |
| storage | only the storage line (`scratch volume` vs `replicated volume`) |
| metadata | only users/activity (`test_user, never` vs `312 users, 2 min ago`) |
| emptiness | only the file count (sparse vs populated) |

File density is balanced inside every other family, so it can't confound them. Each family uses its own vocabulary, so a bag-of-words model *cannot* transfer between families.

All CV is leave-task-out (GroupKFold by task).

## Outputs (in `results/`)

- `probe_by_layer.png` shows four things by layer: the aligned probe AUC, cross-cue transfer, the aligned probe applied to emptiness, and the shuffled-label floor. Bag-of-words baselines appear as horizontal lines.
- `transfer_heatmaps.png` shows train-on-A / test-on-B AUC for three feature sets: activations, mean token embeddings, and bag-of-words.
- `behaviour_effects.png` shows the paired sandbox − prod difference in P(ALLOW) per family, with 95% bootstrap CIs.
- `steering.png` is a dose-response plot. It compares the sandbox direction, 3 norm-matched random directions, and a "safety" positive control. The right panel shows P(A)+P(B), which tells you whether the model is still answering.
- `summary.json` holds the key numbers and caveats. `activations.npz` is a cache for `--reuse`.

## How to read it

1. **The aligned probe will probably hit ~1.0. So will bag-of-words.** That only shows the words differ, so don't headline it.
2. **The headline is cross-cue transfer vs. the baselines.** Bag-of-words sits at 0.5 by construction. If activations transfer well above 0.5, and above mean embeddings, then different surface cues map onto a shared internal direction. If embeddings transfer too, the effect is mostly word similarity (e.g. "test" ≈ "dummy").
3. **Emptiness:** if the aligned probe scores sparse directories as sandbox-ish, emptiness is part of the "tell."
4. **Behaviour:** check `policy_competence_auc` first. If it's near 0.5, the model can't do the task, and behaviour/steering nulls are expected. Report that honestly, and try the 360M model.
5. **Steering** counts only if two things hold: the sandbox curve leaves the grey random band, and P(A)+P(B) doesn't collapse. If even the safety control doesn't move, the strengths are too small. Try `--mults -32,-16,-8,8,16,32`.

## Slide-ready sentences

- "Environment type is decodable at AUC X, but bag-of-words gets Y, so decodability alone means little."
- "A probe trained on naming cues detects metadata cues at AUC Z (bag-of-words: 0.50, embeddings: W)."
- "Sandbox-ish context shifted P(ALLOW) on disallowed tasks by Δ [CI]."
- "Steering along the direction moved P(ALLOW) by … vs … for random directions."
- "This doesn't show the model *knows* it's being tested or acts strategically."
