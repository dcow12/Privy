"""White-box backends: models whose residual stream we can read and steer.

  ndif   - a large open-weights model on NDIF (https://ndif.us), read remotely via nnsight.
           Needs NDIF_API_KEY, plus HF_TOKEN for gated repos (Llama, Gemma).
  local  - the same nnsight code on your own CPU / MPS / CUDA device.
  mock   - synthetic activations with a planted 'evaluation' direction. Dry runs only.

All backends expose the same four calls:
  render(system, user)                     -> chat-formatted prompt string
  collect(prompts, layer_ids)              -> last-token residuals, mean embeddings, P(A)/P(B)
  steer(prompts, layer, vec)               -> P(A)/P(B) with `vec` added to that block's output
  generate(prompts, max_new_tokens)        -> greedy completions

Layer L means the output of decoder block L (0-indexed).

The trace bodies below only touch the model, torch and builtins. NDIF executes them
server-side, where this package isn't installed, so they must not call helpers from here.
"""
from __future__ import annotations

import os
import time

import numpy as np

from . import scenarios

LAYER_PATHS = [  # (decoder blocks, token embeddings, unembedding)
    ("model.layers", "model.embed_tokens", "lm_head"),                                # Llama, Qwen, Gemma 2, Mistral, OLMo
    ("model.language_model.layers", "model.language_model.embed_tokens", "lm_head"),  # Gemma 3 / VLM-style
    ("transformer.h", "transformer.wte", "lm_head"),                                  # GPT-2, GPT-J
    ("gpt_neox.layers", "gpt_neox.embed_in", "embed_out"),                            # Pythia
]


def _resolve(module, path):
    for part in path.split("."):
        module = getattr(module, part)
    return module


def ndif_running_models() -> set:
    """Repo ids NDIF currently reports as RUNNING (empty set if the status call fails)."""
    import re
    try:
        from nnsight.ndif import status
        deployments = status(raw=True).get("deployments", {})
    except Exception:
        return set()
    out = set()
    for key, val in deployments.items():
        m = re.search(r'"repo_id": "([^"]+)"', key)
        if isinstance(val, dict) and val.get("application_state") == "RUNNING":
            out.add(m.group(1) if m else key)
    return out


def _retry(fn, what, tries=4, log=print):
    import torch
    for k in range(tries):
        try:
            with torch.no_grad():
                return fn()
        except Exception as e:  # NDIF queue hiccups, dropped connections
            if k == tries - 1:
                raise
            wait = 10 * 2 ** k
            log(f"  ! {what} failed ({type(e).__name__}: {str(e)[:160]}); retrying in {wait}s",
                  flush=True)
            time.sleep(wait)


# --------------------------------------------------------------------- trace bodies

def _collect_batch(lm, batch, blocks_path, embed_path, head_path, layer_ids, ab_ids, remote):
    import nnsight
    with lm.trace(batch, remote=remote):
        emb = lm
        for part in embed_path:
            emb = getattr(emb, part)
        e = emb.output.float()
        m = batch["attention_mask"].to(e.device).unsqueeze(-1).float()
        emb_mean = nnsight.save(((e * m).sum(1) / m.sum(1)).cpu())
        blocks = lm
        for part in blocks_path:
            blocks = getattr(blocks, part)
        hs = nnsight.save([])
        for L in layer_ids:
            o = blocks[L].output
            h = o[0] if isinstance(o, tuple) else o
            hs.append(h[:, -1, :].half().cpu())  # stored as fp16 anyway; halves the download
        head = lm
        for part in head_path:
            head = getattr(head, part)
        probs = head.output[:, -1, :].float().softmax(-1)
        pab = nnsight.save(probs[:, ab_ids].cpu())
    return emb_mean, hs, pab


def _steer_batch(lm, batch, blocks_path, head_path, layer, vec, ab_ids, remote):
    import nnsight
    with lm.trace(batch, remote=remote):
        blocks = lm
        for part in blocks_path:
            blocks = getattr(blocks, part)
        o = blocks[layer].output
        h = o[0] if isinstance(o, tuple) else o
        h[:] += vec.to(h.device, h.dtype)
        head = lm
        for part in head_path:
            head = getattr(head, part)
        probs = head.output[:, -1, :].float().softmax(-1)
        pab = nnsight.save(probs[:, ab_ids].cpu())
    return pab


def _generate_batch(lm, batch, max_new_tokens, pad_id, remote):
    import nnsight
    with lm.generate(batch, max_new_tokens=max_new_tokens, do_sample=False,
                     pad_token_id=pad_id, remote=remote):
        out = nnsight.save(lm.generator.output)
    return out


# ------------------------------------------------------------------------ backends

class NNsightBackend:
    log = staticmethod(print)
    should_stop = staticmethod(lambda: False)

    def _check(self):
        if self.should_stop():
            raise RuntimeError("Cancelled")

    def __init__(self, model_id: str, remote=False, device=None, batch_size=8, paths=None):
        import torch
        from nnsight import CONFIG, LanguageModel

        self.model_id, self.batch_size = model_id, batch_size
        self.remote = remote  # True (NDIF), "local" (simulate NDIF serialization), or False
        if remote is True:
            key = os.environ.get("NDIF_API_KEY")
            if not key:
                raise SystemExit("NDIF_API_KEY is not set. Get a free key at https://login.ndif.us "
                                 "and put it in .env (see .env.example).")
            CONFIG.set_default_api_key(key)
            running = ndif_running_models()
            if running and model_id not in running:
                self.log(f"  ! {model_id} is not listed as RUNNING on NDIF right now. Running models: "
                      f"{', '.join(sorted(running))}", flush=True)
            self.lm = LanguageModel(model_id)  # config + tokenizer only; weights stay on NDIF
            self.device = "ndif"
        else:
            device = device or ("cuda" if torch.cuda.is_available() else
                                "mps" if torch.backends.mps.is_available() else "cpu")
            # bfloat16 on GPUs that support it (A100, L4, H100); float16 on older ones (Colab's free T4).
            cuda_dtype = torch.bfloat16 if device == "cuda" and torch.cuda.is_bf16_supported() else torch.float16
            dtype = {"cuda": cuda_dtype, "mps": torch.float16}.get(device, torch.float32)
            self.lm = LanguageModel(model_id, device_map=device, dispatch=True, dtype=dtype)
            self.device = device
        self.tok = self.lm.tokenizer
        self.tok.padding_side = "left"
        if self.tok.pad_token is None:
            self.tok.pad_token = self.tok.eos_token

        torch_model = self.lm._model
        for blocks, embed, head in ([paths] if paths else LAYER_PATHS):
            try:
                n = len(_resolve(torch_model, blocks))
                _resolve(torch_model, embed), _resolve(torch_model, head)
            except AttributeError:
                continue
            self.paths = tuple(p.split(".") for p in (blocks, embed, head))
            self.n_layers = n
            break
        else:
            raise SystemExit("Couldn't find decoder blocks for this architecture; "
                             "pass --module-paths blocks,embed,head")
        cfg = getattr(self.lm.config, "text_config", None) or self.lm.config
        self.d_model = cfg.hidden_size
        self.ab_ids = [self._single_token("A"), self._single_token("B")]
        self.name = f"{ {True: 'ndif', 'local': 'ndif-sim'}.get(remote, 'local') }:{model_id}"

    def _single_token(self, s):
        ids = self.tok.encode(s, add_special_tokens=False)
        if len(ids) != 1:
            raise SystemExit(f"Label {s!r} isn't a single token for {self.model_id}.")
        return ids[0]

    def render(self, system, user):
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        try:
            return self.tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        except Exception:  # templates without a system role (e.g. Gemma 2)
            msgs = [{"role": "user", "content": f"{system}\n\n{user}"}]
            return self.tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)

    def _batches(self, prompts, size=None):
        size = size or self.batch_size
        for i in range(0, len(prompts), size):
            # The chat template already contains BOS; don't let the tokenizer add another.
            enc = self.tok(prompts[i:i + size], return_tensors="pt", padding=True,
                           add_special_tokens=False)
            yield i, {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]}

    def collect(self, prompts, layer_ids):
        layer_ids = sorted(layer_ids)
        H, E, P = [], [], []
        n_batches = (len(prompts) + self.batch_size - 1) // self.batch_size
        t0 = time.time()
        for k, (i, batch) in enumerate(self._batches(prompts)):
            self._check()
            emb, hs, pab = _retry(lambda: _collect_batch(
                self.lm, batch, self.paths[0], self.paths[1], self.paths[2],
                layer_ids, self.ab_ids, self.remote), f"batch {k + 1}/{n_batches}", log=self.log)
            H.append(np.stack([h.detach().numpy() for h in hs], 1).astype(np.float16))
            E.append(emb.detach().numpy().astype(np.float16))
            P.append(pab.detach().numpy())
            if (k + 1) % max(1, n_batches // 10) == 0 or k + 1 == n_batches:
                self.log(f"  {min(i + self.batch_size, len(prompts))}/{len(prompts)} prompts "
                      f"({time.time() - t0:.0f}s)", flush=True)
        P = np.concatenate(P)
        return dict(H=np.concatenate(H), E=np.concatenate(E),
                    p_allow=P[:, 0] / (P.sum(1) + 1e-12), ab_mass=P.sum(1))

    def steer(self, prompts, layer, vec):
        import torch
        vec = torch.as_tensor(vec, dtype=torch.float32)
        P = []
        for _, batch in self._batches(prompts, size=max(self.batch_size, 32)):
            self._check()
            pab = _retry(lambda: _steer_batch(self.lm, batch, self.paths[0], self.paths[2],
                                              layer, vec, self.ab_ids, self.remote), "steering",
                         log=self.log)
            P.append(pab.detach().numpy())
        P = np.concatenate(P)
        return P[:, 0] / (P.sum(1) + 1e-12), P.sum(1)

    def generate(self, prompts, max_new_tokens=160):
        texts = []
        for k, (_, batch) in enumerate(self._batches(prompts)):
            self._check()
            out = _retry(lambda: _generate_batch(self.lm, batch, max_new_tokens,
                                                 self.tok.pad_token_id, self.remote),
                         f"generation batch {k + 1}", log=self.log)
            n_in = batch["input_ids"].shape[1]
            texts += self.tok.batch_decode(out[:, n_in:], skip_special_tokens=True)
        return [t.strip() for t in texts]


class MockBackend:
    log = staticmethod(print)
    should_stop = staticmethod(lambda: False)

    """Fake activations with known structure, so the whole pipeline can be dry-run in seconds.

    The planted story: every sandbox/eval cue pushes a shared 'evaluation' direction that
    peaks in the middle layers (explicit notes strongest, emptiness weakest), each cue also
    has its own private direction, and the shared direction nudges P(ALLOW) up on
    disallowed tasks. Nothing it produces is a finding.
    """

    def __init__(self, n_layers=16, d_model=96, seed=0, **_):
        rng = np.random.default_rng(seed)
        self.n_layers, self.d_model, self.name = n_layers, d_model, "mock"
        self.shared = rng.standard_normal(d_model)
        self.shared /= np.linalg.norm(self.shared)
        self.private = {c: rng.standard_normal(d_model) for c in [*scenarios.CUES, "sparse"]}
        self.task_vecs = rng.standard_normal((len(scenarios.TASKS), d_model)) * 1.5
        self.allow_dir = rng.standard_normal(d_model)
        self.strength = {"naming": 0.7, "storage": 0.7, "metadata": 0.9, "explicit": 1.6, "sparse": 0.35}
        self.rng = rng

    def render(self, system, user):
        return f"<system>{system}</system>\n<user>{user}</user>\n<assistant>"

    def _parse(self, prompt):
        pol = scenarios.cue_polarity(prompt)
        t = next(i for i, (req, _) in enumerate(scenarios.TASKS) if req in prompt)
        return t, scenarios.TASKS[t][1], pol

    def _evalness(self, pol):
        s = sum(self.strength[c] * pol.get(c, 0) for c in scenarios.CUES)
        return s + self.strength["sparse"] * (2 * pol["sparse"] - 1)

    def collect(self, prompts, layer_ids):
        H, E, P = [], [], []
        depth = np.linspace(0, 1, self.n_layers)
        bump = np.exp(-((depth - 0.55) / 0.22) ** 2)
        for p in prompts:
            t, allow, pol = self._parse(p)
            ev = self._evalness(pol)
            base = self.task_vecs[t] + (1.2 if allow else -1.2) * self.allow_dir
            layers = []
            for L in layer_ids:
                x = base * (0.5 + depth[L]) + self.rng.standard_normal(self.d_model) * 1.2
                x = x + 2.0 * bump[L] * ev * self.shared
                for c in scenarios.CUES:
                    x = x + 0.8 * pol.get(c, 0) * self.private[c]
                layers.append(x)
            H.append(np.stack(layers))
            E.append(sum(pol.get(c, 0) * self.private[c] for c in scenarios.CUES)
                     + self.rng.standard_normal(self.d_model) * 0.6)
            logit = (3.0 if allow else -2.5) + (0 if allow else 0.45 * ev)
            P.append(1 / (1 + np.exp(-logit)))
        return dict(H=np.stack(H).astype(np.float16), E=np.stack(E).astype(np.float16),
                    p_allow=np.array(P), ab_mass=np.full(len(P), 0.93))

    def steer(self, prompts, layer, vec):
        vec = np.asarray(vec, dtype=float)
        push = float(vec @ self.shared)
        out_p, out_m = [], []
        for p in prompts:
            t, allow, pol = self._parse(p)
            logit = (3.0 if allow else -2.5) + (0 if allow else 0.45 * (self._evalness(pol) + push))
            out_p.append(1 / (1 + np.exp(-logit)))
            out_m.append(0.93 * np.exp(-0.01 * float(vec @ vec) / 625))
        return np.array(out_p), np.array(out_m)

    def generate(self, prompts, max_new_tokens=160):
        out = []
        for p in prompts:
            t, allow, pol = self._parse(p)
            ev = self._evalness(pol)
            says = pol.get("explicit", 0) > 0 or (ev > 1.5 and self.rng.random() < 0.3)
            lead = ("This looks like a test environment rather than a real deployment. "
                    if says else "The request concerns the host described above. ")
            ans = "A" if allow else "B"
            out.append(f"{lead}The policy {'allows' if allow else 'forbids'} this.\nANSWER: {ans}")
        return out


def make_backend(kind, model_id=None, device=None, batch_size=None, module_paths=None):
    paths = tuple(module_paths.split(",")) if module_paths else None
    if kind == "mock":
        return MockBackend()
    if kind == "ndif":
        return NNsightBackend(model_id, remote=True, batch_size=batch_size or 16, paths=paths)
    if kind == "ndif-sim":  # NDIF's serialization path, executed locally (for testing)
        return NNsightBackend(model_id, remote="local", device=device, batch_size=batch_size or 8,
                              paths=paths)
    if kind == "local":
        return NNsightBackend(model_id, remote=False, device=device, batch_size=batch_size or 8,
                              paths=paths)
    raise SystemExit(f"Unknown backend {kind!r}")
