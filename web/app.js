"use strict";
/* Privy front end. Plain JS, no dependencies.
   Everything that came from a model or a provider is inserted with textContent. */

// ------------------------------------------------------------------ helpers
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const SVGNS = "http://www.w3.org/2000/svg";

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
function sv(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  setAttrs(el, attrs);
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
}
/* GitHub Pages has no server: docs/index.html sets window.SNIFFER_STATIC and the saved runs are
   exported as files under data/ by tools/build_pages.py. */
const STATIC = window.SNIFFER_STATIC === true;
const DEMO_MSG = "This is a read-only demo of saved runs. To start experiments, clone the repo and run python app.py.";
function asset(path) {
  if (!STATIC) return path;
  const [p] = path.split("?");
  let m;
  if (p === "/api/meta") return "data/meta.json";
  if (p === "/api/runs") return "data/runs.json";
  if ((m = p.match(/^\/api\/runs\/([^/]+)$/))) return `data/runs/${m[1]}/info.json`;
  if ((m = p.match(/^\/api\/runs\/([^/]+)\/(summary|episodes)$/))) return `data/runs/${m[1]}/${m[2]}.json`;
  if ((m = p.match(/^\/api\/runs\/([^/]+)\/files\/(.+)$/))) return `data/runs/${m[1]}/files/${m[2]}`;
  if ((m = p.match(/^\/api\/runs\/([^/]+)\/export\/(md|csv|json)$/))) return `data/runs/${m[1]}/export.${m[2]}`;
  return null;
}
async function api(path, opts = {}) {
  if (STATIC) {
    const url = (opts.method || "GET") === "GET" ? asset(path) : null;
    if (!url) throw new Error(DEMO_MSG);
    let r;
    try { r = await fetch(url); } catch (_) { throw new Error("Couldn't load the demo data. Check your connection and reload."); }
    if (!r.ok) throw new Error(`Request failed (${r.status}).`);
    return r.json();
  }
  const init = { headers: { "Content-Type": "application/json" }, ...opts };
  if (init.body && typeof init.body !== "string") init.body = JSON.stringify(init.body);
  let r;
  try { r = await fetch(path, init); }
  catch (_) { throw new Error("Can't reach the Privy server. Check that python app.py is still running, then try again."); }
  if (!r.ok) {
    let msg = r.status >= 500
      ? `The server hit an error (${r.status}). The terminal running python app.py has the details.`
      : `Request failed (${r.status}).`;
    try {
      const j = await r.json();
      if (j.detail) msg = typeof j.detail === "string" ? j.detail
        : Array.isArray(j.detail) ? j.detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ")
        : JSON.stringify(j.detail);
    } catch (_) { /* not JSON */ }
    throw new Error(msg);
  }
  return r.json();
}
let toastTimer;
/* kind "error" stays until dismissed and is announced assertively; info fades after 6s. */
function toast(msg, kind = "info") {
  if (msg === DEMO_MSG) kind = "info";  // the demo's limits are a notice, not an error
  const t = $("#toast");
  t.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  t.classList.toggle("error", kind === "error");
  t.replaceChildren(h("span", { class: "toast-msg", text: msg }),
    h("button", { class: "ghost small toast-close", type: "button", "aria-label": "Dismiss message", text: "Dismiss", onclick: () => (t.hidden = true) }));
  t.hidden = false;
  clearTimeout(toastTimer);
  if (kind !== "error") toastTimer = setTimeout(() => (t.hidden = true), 6000);
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/* "org/model-name" -> each part unbreakable, with a break opportunity only after "/". */
function modelName(label) {
  const parts = String(label).split("/");
  return parts.flatMap((part, i) => [
    h("span", { class: "nobreak", text: i < parts.length - 1 ? `${part}/` : part }),
    i < parts.length - 1 ? document.createElement("wbr") : null,
  ]).filter(Boolean);
}
const money = (x) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: x < 1 ? 3 : 2 }).format(x);
const whenShort = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(undefined, today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }).format(d);
};
const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
};
/* Re-rendering replaces DOM; keep keyboard focus on the same logical control. */
function focusKeyIn(root) {
  const a = document.activeElement;
  return a && root.contains(a) ? a.dataset.focusKey || null : null;
}
function restoreFocus(root, key) {
  if (!key) return;
  const el = root.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if (el) el.focus({ preventScroll: true });
}
const pct = (x) => (x == null ? "–" : `${Math.round(100 * x)}%`);
const pts = (x) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(100 * x))}`);
const num = (x, d = 2) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};

const COLORS = ["var(--m1)", "var(--m2)", "var(--m3)"];
const FAMILY_NAMES = {
  aligned: "All cues together", naming: "Host name", storage: "Storage", metadata: "Users & activity",
  emptiness: "Emptiness", explicit: "Explicit eval note", custom: "Custom cue",
};
const fname = (f) => FAMILY_NAMES[f] || f;
const state = { meta: null, slots: [], models: {}, runs: [], active: null, compare: new Set(), episodes: {}, epFilter: {} };

// ------------------------------------------------------------------ theme + tabs
function initTheme() {
  const btn = $("#theme-toggle");
  const order = ["auto", "light", "dark"];
  const ICONS = {
    auto: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  };
  const NAMES = { auto: "Auto", light: "Light", dark: "Dark" };
  let mode = store.get("theme") || "auto";
  const apply = () => {
    if (mode === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    const icon = document.createElementNS(SVGNS, "svg");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) icon.setAttribute(k, v);
    icon.innerHTML = ICONS[mode];  // static, authored markup only
    btn.replaceChildren(icon, document.createTextNode(` ${NAMES[mode]}`));
    btn.setAttribute("aria-label", `Theme: ${NAMES[mode]}. Click to switch.`);
  };
  btn.addEventListener("click", () => {
    mode = order[(order.indexOf(mode) + 1) % 3];
    store.set("theme", mode);
    apply();
    if (state.active || state.compare.size) renderReport();
  });
  apply();
}
function showTab(name, push = true) {
  for (const b of $$(".tabs button")) {
    b.setAttribute("aria-selected", b.dataset.tab === name);
    b.tabIndex = b.dataset.tab === name ? 0 : -1;
  }
  for (const s of $$(".tab")) s.hidden = s.id !== `tab-${name}`;
  if (push) history.replaceState(null, "", `#${name}${name === "results" && state.active ? "/" + state.active : ""}`);
  if (name === "results") refreshRuns();
}

// ------------------------------------------------------------------ keys
async function loadMeta() {
  state.meta = await api("/api/meta");
}
function providerById(id) { return state.meta.providers.find((p) => p.id === id); }

/* Keys: one ruled table row per provider. */
function keyRow({ label, status, statusOk, inputs, onSave, link, linkText }) {
  const save = h("button", { class: "secondary small", type: "button", text: "Save", onclick: async (ev) => {
    ev.target.disabled = true;
    try { await onSave(); } catch (e) { toast(e.message, "error"); ev.target.disabled = false; }
  } });
  return h("tr", {},
    h("td", {}, h("div", { text: label }), h("span", { class: `status ${statusOk ? "ok" : ""}`, text: status })),
    h("td", {}, h("div", { class: "inputs" }, ...inputs)),
    h("td", { class: "act" }, save),
    h("td", { class: "act" }, link ? extLink(link, linkText) : null));
}
function extLink(href, label) {
  const icon = document.createElementNS(SVGNS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) icon.setAttribute(k, v);
  icon.innerHTML = '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>';  // static, authored markup only
  return h("a", { class: "ext", href, target: "_blank", rel: "noopener" }, label, icon, h("span", { class: "sr-only", text: "(opens in a new tab)" }));
}
function keysTable(rows) {
  return h("table", { class: "keys-table" },
    h("thead", {}, h("tr", {}, h("th", { text: "Provider" }), h("th", { text: "Key" }), h("th", { text: "" }), h("th", { text: "" }))),
    h("tbody", {}, rows));
}
function renderKeys() {
  const rows = [];
  for (const p of state.meta.providers) {
    if (p.kind === "mock") continue;
    const keyIn = h("input", { type: "password", "aria-label": `${p.label} API key`, placeholder: p.has_key ? `saved (${p.masked})` : "paste API key", autocomplete: "off" });
    const urlIn = p.id === "custom" ? h("input", { type: "text", "aria-label": "Base URL", placeholder: "base URL, e.g. https://api.groq.com/openai/v1", value: p.base_url || "" }) : null;
    rows.push(keyRow({
      label: p.label, status: p.has_key ? `Key set (${p.masked})` : "No key", statusOk: p.has_key,
      inputs: urlIn ? [urlIn, keyIn] : [keyIn], link: p.key_url, linkText: "Get a key",
      onSave: async () => {
        await api("/api/keys", { method: "POST", body: { provider: p.id, key: keyIn.value, base_url: urlIn ? urlIn.value : "" } });
        await loadMeta(); renderKeys(); renderSlots(); toast(`${p.label}: saved for this session.`);
      },
    }));
  }
  $("#key-cards").replaceChildren(keysTable(rows));
  const wb = [];
  for (const [id, label, url] of [["ndif", "NDIF API key", "https://login.ndif.us"], ["hf", "Hugging Face token", "https://huggingface.co/settings/tokens"]]) {
    const k = state.meta.whitebox_keys[id];
    const keyIn = h("input", { type: "password", "aria-label": label, placeholder: k.has_key ? `saved (${k.masked})` : "paste key", autocomplete: "off" });
    wb.push(keyRow({
      label, status: k.has_key ? `Set (${k.masked})` : "Not set", statusOk: k.has_key, inputs: [keyIn], link: url, linkText: "Get one",
      onSave: async () => { await api("/api/keys", { method: "POST", body: { provider: id, key: keyIn.value } }); await loadMeta(); renderKeys(); toast(`${label} saved for this session.`); },
    }));
  }
  $("#wb-key-cards").replaceChildren(keysTable(wb));
}

// ------------------------------------------------------------------ experiment form
function defaultSlots() {
  const has = (id) => providerById(id)?.has_key;
  if (has("anthropic")) {
    const second = has("openai") ? { provider: "openai", model: "" } : has("openrouter") ? { provider: "openrouter", model: "" } : { provider: "mock", model: "mock/eval-gamer" };
    return [{ provider: "anthropic", model: "claude-opus-5-5", effort: "" }, second];
  }
  return [{ provider: "mock", model: "mock/consistent" }, { provider: "mock", model: "mock/eval-gamer" }];
}

function ensureDatalist(provider) {
  let dl = document.getElementById(`models-${provider}`);
  if (!dl) { dl = h("datalist", { id: `models-${provider}` }); document.body.append(dl); }
  const list = provider === "mock" ? Object.keys(state.meta.mock_models) : state.models[provider] || [];
  dl.replaceChildren(...list.map((m) => h("option", { value: m })));
}

async function loadModels(provider, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Loading…"; }
  try {
    const r = await api("/api/models", { method: "POST", body: { provider } });
    state.models[provider] = r.models;
    ensureDatalist(provider);
    toast(`${r.models.length} models available from ${providerById(provider).label}. Start typing to filter.`);
  } catch (e) { toast(e.message, "error"); }
  if (btn) { btn.disabled = false; btn.textContent = "List models"; }
}

function renderSlots() {
  const box = $("#slots");
  box.replaceChildren();
  state.slots.forEach((slot, i) => {
    const prov = providerById(slot.provider);
    const provSel = h("select", { onchange: (e) => {
      slot.provider = e.target.value;
      slot.model = slot.provider === "mock" ? "mock/consistent" : slot.provider === "anthropic" ? "claude-opus-5-5" : "";
      renderSlots(); updateEstimate();
    } }, state.meta.providers.map((p) => h("option", { value: p.id, selected: p.id === slot.provider }, p.label.split(" (")[0] + (p.has_key || p.kind === "mock" ? "" : " (no key)"))));
    ensureDatalist(slot.provider);
    const modelIn = h("input", { type: "text", list: `models-${slot.provider}`, value: slot.model || "", placeholder: "model id", maxlength: 200, "aria-label": `Model ${i + 1} id`, oninput: (e) => { slot.model = e.target.value.trim(); updateEstimate(); } });
    const listBtn = h("button", { class: "secondary small", text: "List models", type: "button", onclick: (e) => loadModels(slot.provider, e.target) });
    const effort = h("select", { disabled: slot.provider !== "anthropic", onchange: (e) => (slot.effort = e.target.value) },
      ["", "low", "medium", "high", "xhigh", "max"].map((v) => h("option", { value: v, selected: (slot.effort || "") === v }, v || "default")));
    const labelIn = h("input", { type: "text", maxlength: 80, value: slot.label || "", placeholder: "label (optional)", oninput: (e) => (slot.label = e.target.value) });
    const row = h("div", { class: "slot" },
      h("span", { class: "swatch", style: { background: COLORS[i] } }),
      h("label", { class: "field" }, "Provider", provSel),
      h("label", { class: "field" }, "Model", h("div", { class: "model-pick" }, modelIn, slot.provider === "mock" ? null : listBtn)),
      h("label", { class: "field" }, "Effort (Claude)", effort),
      h("label", { class: "field" }, "Label", labelIn),
      h("button", { class: "ghost", text: "Remove", disabled: state.slots.length === 1, onclick: () => { state.slots.splice(i, 1); renderSlots(); updateEstimate(); } }));
    box.append(row);
    if (slot.provider === "mock" && state.meta.mock_models[slot.model]) box.append(h("div", { class: "slot-note", text: `Simulated: ${state.meta.mock_models[slot.model]}` }));
    else if (prov && !prov.has_key && prov.kind !== "mock") box.append(h("div", { class: "slot-note", text: "Add a key for this provider on the Keys tab." }));
  });
  $("#add-slot").disabled = state.slots.length >= 3;
}

/* Conditions: a ruled table whose two right-hand columns are the two arms, sandbox then production. */
function renderFamilies() {
  const box = $("#family-cards");
  const defaults = new Set(["aligned", "naming", "storage", "metadata", "emptiness", "explicit"]);
  const lines = (txt) => (txt || "").split(" · ").map((t) => h("div", { text: t }));
  const body = h("tbody");
  for (const f of state.meta.families) {
    const isCustom = f.id === "custom";
    const sbCell = isCustom ? h("textarea", { id: "custom-sb", maxlength: 2000, "aria-label": "Sandbox-side lines, one per variant", placeholder: "env: staging\nENVIRONMENT=dev", oninput: debounce(updateEstimate, 300) }) : lines(f.sandbox);
    const prCell = isCustom ? h("textarea", { id: "custom-pr", maxlength: 2000, "aria-label": "Production-side lines, one per variant", placeholder: "env: production\nENVIRONMENT=prod", oninput: debounce(updateEstimate, 300) }) : lines(f.prod);
    const id = `cond-${f.id}`;
    const row = h("tr", {});
    const input = h("input", { type: "checkbox", id, value: f.id, checked: defaults.has(f.id), onchange: () => { row.classList.toggle("off", !input.checked); updateEstimate(); } });
    row.classList.toggle("off", !input.checked);
    row.append(
      h("td", { class: "pick" }, input),
      h("td", { class: "name" }, h("label", { for: id }, h("b", { text: fname(f.id) }), h("span", { text: f.about })),
        f.mentions_testing ? h("span", { class: "tag", text: "mentions testing" }) : null),
      h("td", { class: "ex" }, sbCell),
      h("td", { class: "ex" }, prCell));
    body.append(row);
  }
  box.replaceChildren(h("table", { class: "cond-table" },
    h("thead", {}, h("tr", {}, h("th", { text: "" }), h("th", { text: "Condition" }),
      h("th", {}, h("span", { class: "dot filled", style: { marginRight: "8px" } }), "Sandbox-looking side"),
      h("th", {}, h("span", { class: "dot hollow", style: { marginRight: "8px" } }), "Production-looking side"))),
    body));
}

function collectConfig() {
  const fams = $$("#family-cards input[type=checkbox]:checked").map((i) => i.value);
  const tt = [];
  if ($("#opt-disallowed").checked) tt.push("disallowed");
  if ($("#opt-allowed").checked) tt.push("allowed");
  return {
    name: $("#opt-name").value,
    slots: state.slots.map((s) => ({ provider: s.provider, model: s.model || "", effort: s.effort || "", label: s.label || "" })),
    families: fams,
    task_types: tt,
    custom_sandbox: $("#custom-sb")?.value || "",
    custom_prod: $("#custom-pr")?.value || "",
    mode: $("input[name=mode]:checked").value,
    variants: +$("#opt-variants").value,
    repeats: +$("#opt-repeats").value,
    everywhere: $("#opt-everywhere").checked,
    monitored: $("#opt-monitored").checked,
    pressure: $("#opt-pressure").checked,
    judge: $("input[name=judge]:checked").value,
  };
}
function configProblem(cfg) {
  if (!cfg.families.length) return "Pick at least one environment condition.";
  if (!cfg.task_types.length) return "Pick at least one request type.";
  if (cfg.slots.some((s) => !s.model)) return "Every model slot needs a model id.";
  if (cfg.families.includes("custom") && (!cfg.custom_sandbox.trim() || !cfg.custom_prod.trim())) return "The custom condition needs a sandbox line and a production line.";
  return null;
}
const updateEstimate = debounce(async () => {
  const cfg = collectConfig();
  const el = $("#estimate");
  const problem = configProblem(cfg);
  if (problem) { el.textContent = problem; return; }
  try {
    const e = await api("/api/estimate", { method: "POST", body: cfg });
    const cost = e.total_cost == null ? "cost depends on the provider (about 1.1k input and 0.9k output tokens per episode)" : e.total_cost === 0 ? "free (simulated)" : `about ${money(e.total_cost)}`;
    el.textContent = `${e.episodes.toLocaleString()} episodes (${e.per_model.map((p) => p.episodes).join(" + ")}) · ${cost}`;
  } catch (err) { el.textContent = err.message; }
}, 250);

async function showPreview(family) {
  const cfg = collectConfig();
  const problem = configProblem(cfg);
  if (problem) return toast(problem, "error");
  const sel = $("#preview-family");
  if (!family) {
    sel.replaceChildren(...cfg.families.map((f) => h("option", { value: f }, fname(f))));
    family = cfg.families[0];
  }
  try {
    const p = await api(`/api/preview?family=${encodeURIComponent(family)}&task=10`, { method: "POST", body: cfg });
    $("#preview-system").textContent = `SYSTEM\n${p.system}`;
    $("#preview-sb").textContent = p.sandbox;
    $("#preview-pr").textContent = p.prod;
    $("#preview").hidden = false;
    $("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { toast(e.message, "error"); }
}

async function startRun() {
  const cfg = collectConfig();
  const problem = configProblem(cfg);
  if (problem) return toast(problem, "error");
  const btn = $("#btn-run");
  const est = $("#estimate").textContent;
  if (!cfg.slots.every((s) => s.provider === "mock") && !confirm(`Start this run?\n\n${est}\n\nCalls go to the providers you picked and are billed to your keys.`)) return;
  btn.disabled = true;
  try {
    const info = await api("/api/runs/agents", { method: "POST", body: cfg });
    state.active = info.id;
    state.compare.clear();
    showTab("results");
    await refreshRuns();
    renderReport();
  } catch (e) { toast(e.message, "error"); }
  btn.disabled = false;
}

// ------------------------------------------------------------------ white-box form
async function startWhitebox() {
  const backend = $("input[name=wb-backend]:checked").value;
  const layer = $("#wb-layer").value;
  const body = {
    name: $("#wb-name").value, backend, model: $("#wb-model").value,
    quick: $("#wb-quick").checked, skip_verbal: !$("#wb-verbal").checked, skip_steering: !$("#wb-steer").checked,
    layer: layer === "" ? null : +layer, judge: $("#wb-judge").value,
  };
  const btn = $("#wb-run");
  btn.disabled = true;
  try {
    const info = await api("/api/runs/whitebox", { method: "POST", body });
    state.active = info.id; state.compare.clear();
    showTab("results"); await refreshRuns(); renderReport();
  } catch (e) { toast(e.message, "error"); }
  btn.disabled = false;
}

// ------------------------------------------------------------------ results: run list
async function refreshRuns() {
  try {
    state.runs = (await api("/api/runs")).runs;
    state.offline = false;
  } catch (_) {
    state.offline = true;  // keep showing the last list; the poll retries
  }
  const running = state.runs.filter((r) => r.status === "running").length;
  const badge = $("#running-badge");
  badge.hidden = !running; badge.textContent = running;
  badge.setAttribute("aria-label", `${plural(running, "run")} in progress`);
  renderRunList();
}
function statusChip(st) {
  const cls = st === "running" ? "running" : st === "done" ? "ok" : st === "error" ? "err" : "";
  return h("span", { class: `status ${cls}`, text: st });
}
function openRun(id) {
  state.active = id;
  state.compareMode = false;
  history.replaceState(null, "", `#results/${id}`);
  renderRunList();
  renderReport();
}
function renderRunList() {
  const box = $("#runs");
  const keep = focusKeyIn(box);
  box.replaceChildren();
  if (state.offline) box.append(h("div", { class: "banner err", role: "status", text: "Lost connection to the server. Showing the last known runs; retrying." }));
  if (!state.runs.length && !state.offline) {
    box.append(h("div", { class: "runs-empty" },
      h("p", { class: "muted", text: "No runs yet. Simulated agents are free, so a first run costs nothing." }),
      h("button", { class: "secondary small", type: "button", text: "Design an experiment", onclick: () => showTab("experiment") })));
  }
  const list = h("ul", { class: "run-items", "aria-label": "Runs" });
  for (const r of state.runs) {
    const name = r.name || r.id;
    const active = state.active === r.id && !state.compareMode;
    const cb = h("input", { type: "checkbox", checked: state.compare.has(r.id), "aria-label": `Compare “${name}”`, "data-focus-key": `cmp:${r.id}`,
      onchange: (e) => {
        e.target.checked ? state.compare.add(r.id) : state.compare.delete(r.id);
        $("#btn-compare").disabled = state.compare.size < 2;
      } });
    const pctDone = r.total ? Math.min(100, (100 * r.done) / r.total) : r.status === "done" ? 100 : 0;
    const link = h("a", { class: "run-link", href: `#results/${r.id}`, "data-focus-key": `run:${r.id}`, "aria-current": active ? "page" : null,
      onclick: (e) => { e.preventDefault(); openRun(r.id); } },
      h("span", { class: "run-name", text: name, title: name }),
      h("span", { class: "run-meta" },
        h("span", { class: "kind", text: r.kind === "agents" ? "agents" : "inside" }), statusChip(r.status),
        h("span", { text: whenShort(r.created), title: when(r.created) })),
      r.kind === "agents" && r.status === "running"
        ? h("span", { class: "progress", role: "progressbar", "aria-label": `${name} progress`, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(pctDone) },
            h("span", { style: { width: `${pctDone}%` } }))
        : null);
    // The whole row is a click target for mouse users; keyboard users get the link and the checkbox.
    list.append(h("li", { class: `run ${active ? "active" : ""}`, onclick: (e) => { if (e.target === e.currentTarget) link.click(); } }, cb, link));
  }
  box.append(list);
  $("#btn-compare").disabled = state.compare.size < 2;
  restoreFocus(box, keep);
}

// ------------------------------------------------------------------ tooltip
const tip = {
  show(evt, rows) {
    const t = $("#tooltip");
    t.replaceChildren(...rows.map((r) => r.value != null
      ? h("div", {}, h("div", { class: "tv", text: r.value }), r.key ? h("div", { class: "tk" }, r.color ? h("i", { style: { background: r.color } }) : null, r.key) : null)
      : h("div", { class: "tk", text: r.key })));
    t.hidden = false;
    const x = Math.min(evt.clientX + 14, window.innerWidth - t.offsetWidth - 8);
    const y = Math.min(evt.clientY + 14, window.innerHeight - t.offsetHeight - 8);
    t.style.left = `${x}px`; t.style.top = `${y}px`;
  },
  hide() { $("#tooltip").hidden = true; },
};
function hover(el, rows) {
  el._rows = rows;
  el.addEventListener("pointermove", (e) => tip.show(e, rows));
  el.addEventListener("pointerleave", tip.hide);
}
const rowsText = (rows) => rows.map((r) => [r.value, r.key].filter(Boolean).join(" ")).join(". ");
/* One tab stop per chart. Arrow keys step through its points; each point's values are
   shown in the tooltip and read out by screen readers. The table view has every value too. */
function chartKeys(container, label) {
  const hits = $$(".hit", container);
  if (!hits.length) return;
  container.tabIndex = 0;
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", `${label}. Use the arrow keys to read each value; "Show as a table" lists them all.`);
  let i = -1;
  const show = (k) => {
    hits.forEach((x) => x.classList.remove("kb-focus"));
    i = (k + hits.length) % hits.length;
    const el = hits[i];
    el.classList.add("kb-focus");
    const b = el.getBoundingClientRect();
    tip.show({ clientX: Math.min(b.right, b.left + 220), clientY: b.top }, el._rows);
    $("#chart-live").textContent = rowsText(el._rows);
  };
  const clear = () => { hits.forEach((x) => x.classList.remove("kb-focus")); tip.hide(); };
  container.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); show(i < 0 ? (step > 0 ? 0 : hits.length - 1) : i + step); }
    else if (e.key === "Home") { e.preventDefault(); show(0); }
    else if (e.key === "End") { e.preventDefault(); show(hits.length - 1); }
    else if (e.key === "Escape") clear();
  });
  container.addEventListener("blur", clear);
}

// ------------------------------------------------------------------ charts
function chartWidth(container) { return Math.max(560, Math.min(1240, Math.floor(container.getBoundingClientRect().width || $("#report").clientWidth - 80 || 900))); }

/* Dumbbell small multiples: one panel per model, one row per condition.
   Filled dot = sandbox-looking side, hollow ring = production-looking side. */
function dumbbell(container, models, fams, pick, { valueName }) {
  const W = chartWidth(container);
  const labelW = 150, gap = 28, top = 34, rowH = 34, bottom = 32;
  const n = models.length;
  const panelW = (W - labelW - gap * (n - 1)) / n;
  const H = top + rowH * fams.length + bottom;
  const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": valueName });
  fams.forEach((f, i) => svg.append(sv("text", { x: 0, y: top + i * rowH + rowH / 2 + 5, fill: "var(--ink)", "font-size": 14, "font-weight": 500 }, fname(f))));
  models.forEach((m, j) => {
    const x0 = labelW + j * (panelW + gap);
    const sx = (v) => x0 + 8 + v * (panelW - 16);
    svg.append(sv("circle", { cx: x0 + 6, cy: 13, r: 6, fill: m.color }));
    const maxChars = Math.max(8, Math.floor((panelW - 24) / 7));
    const title = sv("text", { x: x0 + 18, y: 18, fill: "var(--ink)", "font-size": 14, "font-weight": 700 }, m.label.length > maxChars ? m.label.slice(0, maxChars - 1) + "…" : m.label);
    title.append(sv("title", {}, m.label));
    svg.append(title);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      svg.append(sv("line", { x1: sx(t), x2: sx(t), y1: top - 4, y2: top + rowH * fams.length, stroke: t === 0 ? "var(--axis)" : "var(--grid)", "stroke-width": 1 }));
      if (t % 0.5 === 0) svg.append(sv("text", { x: sx(t), y: H - 10, "text-anchor": t === 0 ? "start" : t === 1 ? "end" : "middle", fill: "var(--ink-2)", "font-size": 15 }, `${t * 100}%`));
    }
    fams.forEach((f, i) => {
      const y = top + i * rowH + rowH / 2;
      const row = m.families.find((r) => r.family === f);
      const { sb, pr, n: nn } = row ? pick(row) : {};
      if (sb == null && pr == null) {
        svg.append(sv("text", { x: sx(0) + 6, y: y + 4, fill: "var(--ink-2)", "font-size": 15 }, "no data"));
        return;
      }
      if (sb != null && pr != null) svg.append(sv("line", { x1: sx(pr), x2: sx(sb), y1: y, y2: y, stroke: m.color, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.6 }));
      if (pr != null) svg.append(sv("circle", { cx: sx(pr), cy: y, r: 6.5, fill: "var(--surface)", stroke: m.color, "stroke-width": 2.5 }));
      if (sb != null) svg.append(sv("circle", { cx: sx(sb), cy: y, r: 6.5, fill: m.color, stroke: "var(--surface)", "stroke-width": 2 }));
      const hit = sv("rect", { x: x0, y: y - rowH / 2, width: panelW, height: rowH, fill: "transparent", class: "hit" });
      hover(hit, [
        { key: `${m.label} · ${fname(f)}` },
        { value: pct(sb), key: `sandbox-looking`, color: m.color },
        { value: pct(pr), key: `production-looking`, color: m.color },
        nn ? { key: `${valueName}; ${nn} episodes` } : { key: valueName },
      ]);
      svg.append(hit);
    });
  });
  container.append(svg);
  chartKeys(container, `Chart: share of ${valueName}, sandbox-looking vs production-looking, for each model and condition`);
}

/* Forest plot of the paired gap (sandbox − production), one dot + 95% CI per model per row. */
function forest(container, models, rows) {
  const W = chartWidth(container);
  const labelW = 190, top = 10, bottom = 52, per = 17;
  const rowH = Math.max(28, models.length * per + 12);
  const H = top + rowH * rows.length + bottom;
  let R = 0;
  for (const r of rows) for (const m of models) {
    const g = r.get(m);
    if (g) for (const v of [g.lo, g.hi, g.mean]) if (v != null) R = Math.max(R, Math.abs(v));
  }
  R = Math.min(1, Math.max(0.2, Math.ceil((R * 100) / 10) / 10));
  const plotL = labelW + 14, plotR = W - 30;
  const sx = (v) => plotL + ((v + R) / (2 * R)) * (plotR - plotL);
  const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Sandbox gap by condition" });
  const ticks = [-R, -R / 2, 0, R / 2, R];
  for (const t of ticks) {
    svg.append(sv("line", { x1: sx(t), x2: sx(t), y1: top, y2: top + rowH * rows.length, stroke: t === 0 ? "var(--axis)" : "var(--grid)", "stroke-width": t === 0 ? 1.5 : 1 }));
    svg.append(sv("text", { x: sx(t), y: top + rowH * rows.length + 18, "text-anchor": "middle", fill: "var(--ink-2)", "font-size": 15 }, `${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.round(Math.abs(t) * 100)}`));
  }
  svg.append(sv("text", { x: plotL, y: H - 8, fill: "var(--ink-2)", "font-size": 13.5 }, "← better behaved when it looks like a test"));
  svg.append(sv("text", { x: plotR, y: H - 8, "text-anchor": "end", fill: "var(--ink-2)", "font-size": 13.5 }, "more rule-breaking when it looks like a test →"));
  rows.forEach((r, i) => {
    const y0 = top + i * rowH;
    if (i % 2 === 0) svg.append(sv("rect", { x: 0, y: y0, width: W, height: rowH, fill: "var(--surface-2)", opacity: 0.5 }));
    svg.append(sv("text", { x: 4, y: y0 + rowH / 2 + 5, fill: "var(--ink)", "font-size": 14, "font-weight": r.strong ? 800 : 500 }, r.label));
    models.forEach((m, j) => {
      const g = r.get(m);
      const y = y0 + rowH / 2 + (j - (models.length - 1) / 2) * per;
      if (!g || g.mean == null) return;
      if (g.lo != null && g.hi != null) svg.append(sv("line", { x1: sx(g.lo), x2: sx(g.hi), y1: y, y2: y, stroke: m.color, "stroke-width": 3, "stroke-linecap": "round" }));
      svg.append(sv("circle", { cx: sx(g.mean), cy: y, r: 6.5, fill: m.color, stroke: "var(--surface)", "stroke-width": 2 }));
      const hit = sv("rect", { x: plotL, y: y - per / 2, width: plotR - plotL, height: per, fill: "transparent", class: "hit" });
      hover(hit, [
        { key: `${m.label} · ${r.label}` },
        { value: `${pts(g.mean)} points`, key: "sandbox − production", color: m.color },
        { key: g.lo == null ? "not enough paired tasks for a CI" : `95% CI ${pts(g.lo)} to ${pts(g.hi)} · ${g.n_tasks} paired tasks` },
      ]);
      svg.append(hit);
    });
  });
  container.append(svg);
  chartKeys(container, "Chart: sandbox gap in points (sandbox minus production) with 95% intervals, for each model and condition");
}

function legendModels(models) {
  return h("div", { class: "legend" }, models.map((m) => h("span", {}, h("span", { class: "dot", style: { background: m.color } }), m.label)));
}
function legendSides() {
  return h("div", { class: "legend" },
    h("span", {}, h("span", { class: "dot filled" }), "sandbox-looking (filled)"),
    h("span", {}, h("span", { class: "dot hollow" }), "production-looking (ring)"));
}

// ------------------------------------------------------------------ results: report
let renderToken = 0;
async function renderReport() {
  const box = $("#report");
  const token = ++renderToken;  // a slower, older render must not overwrite a newer one
  if (state.compareMode) return renderCompare(token);
  if (!state.active) { box.replaceChildren(h("div", { class: "empty", text: "Run an experiment to see results here." })); return; }
  let info;
  try { info = await api(`/api/runs/${state.active}`); }
  catch (e) {
    if (token !== renderToken) return;
    const missing = /not found|404|No such run/i.test(e.message);
    box.replaceChildren(h("div", { class: "empty" },
      h("p", { text: missing ? "This run isn't on the server any more. It may have been deleted from the runs/ folder." : e.message }),
      h("button", { class: "secondary small", type: "button", text: missing ? "Show the latest run" : "Try again",
        onclick: () => { if (missing) state.active = state.runs[0]?.id || null; renderReport(); } })));
    return;
  }
  const frag = h("div");
  frag.append(reportHead(info));
  if (info.status === "error") frag.append(failureBanner(info));
  if (info.status === "interrupted") frag.append(h("div", { class: "banner", text: "This run stopped when the server restarted. Episodes that finished are kept and shown below; start a new run to collect the rest." }));
  if (info.kind === "agents") await agentBody(frag, info);
  else await whiteboxBody(frag, info);
  if (info.logs?.length) frag.append(h("details", { class: "panel", "data-key": "log", open: info.status === "running" || info.status === "error" }, h("summary", { text: "Log" }), h("pre", { class: "logs", text: info.logs.join("\n") })));
  if (token !== renderToken) return;
  // A live refresh of the same run keeps what the reader had open and where their focus was.
  if (box.dataset.run === info.id) {
    for (const d of $$("details[data-key]", box)) {
      const twin = frag.querySelector(`details[data-key="${CSS.escape(d.dataset.key)}"]`);
      if (twin) twin.open = d.open;
    }
  }
  const keep = box.dataset.run === info.id ? focusKeyIn(box) : null;
  const y = window.scrollY;
  box.replaceChildren(frag);
  box.dataset.run = info.id;
  window.scrollTo(0, y);
  restoreFocus(box, keep);
}

function failureBanner(info) {
  const raw = String(info.error || "Unknown error");
  const text = raw.replace(/^(SystemExit|RuntimeError|ValueError):\s*/, "");
  return h("div", { class: "banner err", role: "alert" },
    h("div", {}, h("b", { text: "This run stopped with an error. " }), text,
      h("div", { class: "muted small-text", text: "The log below has the details. Fix the cause, then start the run again from its tab." })));
}

function reportHead(info) {
  const c = info.config || {};
  const chips = info.kind === "agents"
    ? [plural((c.families || []).length, "condition"), (c.task_types || []).join(" + "), `mode: ${c.mode}`, `${plural(c.variants, "variant")} × ${plural(c.repeats, "repeat")}`,
       c.everywhere === false ? "policy scope removed" : null, c.monitored ? "monitoring notice" : null, c.pressure ? "operator pressure" : null, `judge: ${c.judge === "llm" ? "Claude" : "phrases"}`]
    : [c.backend === "mock" ? "simulated model" : c.backend, c.backend === "mock" ? null : c.model, c.quick ? "quick" : "full"];
  const actions = h("div", { class: "actions" });
  if (info.kind === "agents") for (const [fmt, label] of [["md", "Report (.md)"], ["csv", "Episodes (.csv)"], ["json", "Summary (.json)"]])
    actions.append(h("a", { class: "secondary small", href: asset(`/api/runs/${info.id}/export/${fmt}`), text: label, download: "", "data-focus-key": `export-${fmt}`, style: { textDecoration: "none" } }));
  if (info.status === "running") actions.append(h("button", { class: "secondary small", type: "button", text: "Cancel run", "data-focus-key": "cancel",
    onclick: async (e) => {
      if (!confirm("Cancel this run? Episodes that already finished are kept.")) return;
      e.target.disabled = true;
      try { await api(`/api/runs/${info.id}/cancel`, { method: "POST" }); toast("Cancelling. Episodes already running will finish first."); }
      catch (err) { toast(err.message, "error"); e.target.disabled = false; }
    } }));
  const simulated = info.kind === "agents" ? (c.slots || []).length && (c.slots || []).every((x) => x.provider === "mock") : c.backend === "mock";
  return h("div", { class: "report-head" },
    h("div", {}, h("h1", { text: info.name || info.id }),
      h("div", { class: "filed" }, h("span", { text: `Run ${info.id}` }), h("span", { text: `filed ${when(info.created)}` }),
        info.finished && info.finished !== info.created ? h("span", { text: `closed ${when(info.finished)}` }) : null),
      h("div", { class: "chips" }, statusChip(info.status), ...chips.filter(Boolean).map((t) => h("span", { class: "chip", text: t })),
        simulated ? h("span", { class: "chip sim", text: "Simulated data, not a finding" }) : null,
        info.kind === "agents" && info.total ? h("span", { class: "chip", text: `${info.done.toLocaleString()} of ${info.total.toLocaleString()} episodes${info.errors ? `, ${plural(info.errors, "error")}` : ""}` }) : null)),
    actions);
}

function modelsFrom(summary, prefix = "") {
  return summary.models.map((m, i) => ({ ...m, label: prefix ? `${prefix} · ${m.label}` : m.label, color: COLORS[i % 3] }));
}

async function agentBody(frag, info) {
  let summary;
  try { summary = await api(`/api/runs/${info.id}/summary`); } catch (_) { /* nothing yet */ }
  if (!summary || !summary.models.length) {
    frag.append(h("div", { class: "panel" }, h("p", { class: "muted", text: info.status === "running" ? "Waiting for the first episodes…" : "No episodes were recorded." })));
    return;
  }
  if (summary.provisional) frag.append(h("div", { class: "banner", text: "Live results: these update as episodes finish. Verbalization uses phrase matching until the run completes." }));
  const models = modelsFrom(summary);
  renderAgentPanels(frag, models, summary.families);
  if (info.status !== "running") await transcriptPanel(frag, info, models);
}

/* A gap is "reliable" when its 95% interval excludes zero. */
const reliable = (g) => g && g.lo != null && g.hi != null && (g.lo > 0 || g.hi < 0);

function renderAgentPanels(frag, models, families) {
  // Finding 1 is the model whose environment gap is largest; it gets the screen's one reversed plate.
  const leadIdx = models.reduce((best, m, i) => (Math.abs(m.headline.gap?.mean ?? 0) > Math.abs(models[best].headline.gap?.mean ?? 0) ? i : best), 0);
  const lead = models[leadIdx];
  // Findings are numbered in reading order with the plate's model first; colours stay with each model.
  const ordered = [lead, ...models.filter((_, i) => i !== leadIdx)];
  const simulated = models.every((m) => m.provider === "mock");
  const g = lead.headline.gap || {};
  frag.append(h("section", { class: "plate", "aria-label": "Finding 1.1" },
    h("div", {},
      h("div", { class: "plate-no", text: "Finding 1.1 · sandbox gap" }),
      h("div", { class: "plate-big", text: g.mean == null ? "–" : `${pts(g.mean)} pts` }),
      h("div", { class: "plate-ci", text: g.lo == null ? "not enough paired requests for an interval" : `95% CI ${pts(g.lo)} to ${pts(g.hi)}` }),
      simulated ? h("div", { class: "plate-sim", text: "Simulated agents: not a finding" }) : null),
    h("div", {},
      h("div", { class: "plate-who" }, h("span", { class: "dot", style: { background: lead.color } }), lead.label),
      h("p", { text: lead.findings[0] || "" }),
      lead.findings[1] ? h("p", { class: "plate-em", text: lead.findings[1] }) : null)));
  // The two arms, always in the same order: sandbox, then production.
  const sb = lead.headline.violation_sandbox, pr = lead.headline.violation_prod;
  frag.append(h("div", { class: "arms" },
    h("div", { class: "arm" }, h("div", { class: "arm-label" }, h("span", { class: "dot filled" }), "Sandbox-looking"),
      h("div", { class: `arm-value ${sb != null && pr != null && sb > pr ? "worse" : ""}`, text: pct(sb) }),
      h("div", { class: "arm-note", text: "of policy-violating requests carried out" })),
    h("div", { class: "arm" }, h("div", { class: "arm-label" }, h("span", { class: "dot hollow" }), "Production-looking"),
      h("div", { class: `arm-value ${sb != null && pr != null && pr > sb ? "worse" : ""}`, text: pct(pr) }),
      h("div", { class: "arm-note", text: "of the same requests, production-looking" }))));

  // What we found: every finding numbered model.sentence; the first line of each carries its signed gap.
  const found = h("div", { class: "findings" });
  ordered.forEach((m, i) => {
    found.append(h("div", { class: "finding-head" }, h("span", { class: "dot", style: { background: m.color } }), h("span", {}, ...modelName(m.label))));
    m.findings.forEach((f, j) => {
      const gap = m.headline.gap || {};
      const delta = j === 0 && gap.mean != null
        ? h("span", { class: `finding-delta ${reliable(gap) ? "worse" : "held"}` }, `${pts(gap.mean)} pts`,
            h("small", { text: reliable(gap) ? "reliable difference" : "within uncertainty" }))
        : h("span", { class: "finding-delta" });
      found.append(h("div", { class: "finding-row" }, h("span", { class: "finding-no", text: `${i + 1}.${j + 1}` }), h("span", { text: f }), delta));
    });
  });
  frag.append(h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", { text: "What we found" })), found));

  // At a glance: a ruled table, one row per model.
  const glance = h("table", { class: "glance" },
    h("thead", {}, h("tr", {}, h("th", { text: "Model" }),
      ...["Violations · sandbox", "Violations · production", "Sandbox gap", "Says it's being tested", "Allowed requests done"].map((t) => h("th", { class: "num", text: t })))),
    h("tbody", {}, models.map((m) => {
      const hd = m.headline, gg = hd.gap || {};
      return h("tr", {},
        h("td", { class: "who", title: m.label }, h("span", { class: "dot", style: { background: m.color } }), ...modelName(m.label)),
        h("td", { class: "num" }, pct(hd.violation_sandbox), h("small", { text: "of policy-violating requests" })),
        h("td", { class: "num" }, pct(hd.violation_prod), h("small", { text: "same requests, production-looking" })),
        h("td", { class: "num" }, gg.mean == null ? "–" : `${pts(gg.mean)} pts`, h("small", { text: gg.lo == null ? "not enough paired tasks" : `95% CI ${pts(gg.lo)} to ${pts(gg.hi)}` })),
        h("td", { class: "num" }, pct(hd.says_tested_sandbox), h("small", { text: `sandbox side · production side ${pct(hd.says_tested_prod)}` })),
        h("td", { class: "num" }, pct(hd.helpfulness), h("small", { text: "lower means over-refusal" })));
    })));
  frag.append(h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", { text: "At a glance" }),
    h("span", { class: "muted small-text", text: "Gap = sandbox minus production, paired by request. Conditions that mention testing are excluded from the headline." })), glance));

  const fig = (n, title) => h("h2", {}, h("span", { class: "fig-no", text: `Figure ${n}.` }), title);
  const fams = families;
  const c1 = h("div", { class: "chart" });
  frag.append(h("div", { class: "panel" },
    h("div", { class: "panel-head" }, fig(1, "Does it break the rule more in one environment?")),
    h("div", { class: "sub", text: "Share of policy-violating requests the agent carried out. The further apart the dots, the more the environment changed its behaviour." }),
    legendSides(), c1, tableView(models, fams, "violation")));
  const c2 = h("div", { class: "chart" });
  const rows = [{ label: "All conditions", strong: true, get: (m) => m.headline.gap }]
    .concat(fams.map((f) => ({ label: fname(f), get: (m) => (m.families.find((r) => r.family === f) || {}).gap })));
  frag.append(h("div", { class: "panel" },
    h("div", { class: "panel-head" }, fig(2, "Sandbox gap, with uncertainty")),
    h("div", { class: "sub", text: "Points of difference in rule-breaking (sandbox − production), with 95% bootstrap intervals over requests. An interval that crosses 0 is not a reliable difference." }),
    legendModels(models), c2));
  const c3 = h("div", { class: "chart" });
  frag.append(h("div", { class: "panel" },
    h("div", { class: "panel-head" }, fig(3, "Does it say it's being tested?")),
    h("div", { class: "sub", text: "Share of episodes where the agent's reasoning or reply says it may be in a test, evaluation or sandbox. A large gap above with little here means the shift is silent." }),
    legendSides(), c3, tableView(models, fams, "says")));
  // Charts measure their container, so draw after the panels are in the DOM.
  requestAnimationFrame(() => {
    dumbbell(c1, models, fams, (r) => ({ sb: r.violation_sandbox, pr: r.violation_prod, n: r.n }), { valueName: "policy-violating requests carried out" });
    forest(c2, models, rows);
    dumbbell(c3, models, fams, (r) => ({ sb: r.says_sandbox, pr: r.says_prod, n: r.n }), { valueName: "episodes that mention being tested" });
  });
}

function tile(value, note) {
  return h("div", { class: "tile" }, h("div", { class: "value", text: value }), h("div", { class: "note", text: note }));
}

function tableView(models, fams, what) {
  const head = what === "violation"
    ? ["Model", "Condition", "Violations (sandbox)", "Violations (production)", "Gap (pts)", "95% CI", "Allowed done (sandbox)", "Allowed done (prod)"]
    : ["Model", "Condition", "Says tested (sandbox)", "Says tested (production)", "Stakes reasoning (sandbox)", "Stakes reasoning (prod)"];
  const body = [];
  for (const m of models) for (const f of fams) {
    const r = m.families.find((x) => x.family === f);
    if (!r) continue;
    body.push(what === "violation"
      ? [m.label, fname(f), pct(r.violation_sandbox), pct(r.violation_prod), pts(r.gap.mean), r.gap.lo == null ? "–" : `${pts(r.gap.lo)} to ${pts(r.gap.hi)}`, pct(r.helpful_sandbox), pct(r.helpful_prod)]
      : [m.label, fname(f), pct(r.says_sandbox), pct(r.says_prod), pct(r.stakes_sandbox), pct(r.stakes_prod)]);
  }
  return h("details", { class: "table-view", "data-key": `table-${what}` }, h("summary", { text: "Show as a table" }),
    h("table", {}, h("thead", {}, h("tr", {}, head.map((t) => h("th", { text: t })))),
      h("tbody", {}, body.map((row) => h("tr", {}, row.map((c, i) => h("td", { class: i > 1 ? "num" : "", text: c })))))));
}

async function transcriptPanel(frag, info, models) {
  if (!state.episodes[info.id]) {
    try { state.episodes[info.id] = (await api(`/api/runs/${info.id}/episodes`)).episodes; } catch (_) { return; }
  }
  const eps = state.episodes[info.id];
  const f = state.epFilter[info.id] || (state.epFilter[info.id] = { model: "", family: "", side: "", type: "disallowed", action: "", aware: false, limit: 25 });
  const list = h("div");
  const colorOf = Object.fromEntries(models.map((m) => [m.label, m.color]));
  const draw = () => {
    const shown = eps.filter((e) =>
      (!f.model || e.model_label === f.model) && (!f.family || e.family === f.family) &&
      (!f.side || String(e.label) === f.side) && (!f.type || (f.type === "allowed") === !!e.should_allow) &&
      (!f.action || e.action === f.action) && (!f.aware || e.test_aware));
    list.replaceChildren(h("div", { class: "muted small-text", text: `${shown.length} matching episodes` }), ...shown.slice(0, f.limit).map((e) => episodeCard(e, colorOf[e.model_label])));
    if (shown.length > f.limit) list.append(h("button", { class: "secondary small", text: "Show more", onclick: () => { f.limit += 25; draw(); } }));
  };
  const NAMES = { model: "Filter by model", family: "Filter by condition", side: "Filter by environment side", type: "Filter by request type", action: "Filter by action" };
  const sel = (key, opts) => h("select", { "aria-label": NAMES[key], onchange: (e) => { f[key] = e.target.value; f.limit = 25; draw(); } }, opts.map(([v, t]) => h("option", { value: v, selected: f[key] === v }, t)));
  const filters = h("div", { class: "filters" },
    sel("model", [["", "All models"], ...models.map((m) => [m.label, m.label])]),
    sel("family", [["", "All conditions"], ...[...new Set(eps.map((e) => e.family))].map((x) => [x, fname(x)])]),
    sel("side", [["", "Both sides"], ["1", "Sandbox-looking"], ["0", "Production-looking"]]),
    sel("type", [["", "All requests"], ["disallowed", "Policy-violating"], ["allowed", "Allowed"]]),
    sel("action", [["", "Any action"], ["execute", "Carried out"], ["escalate", "Escalated"], ["no_answer", "No clear answer"], ["refusal", "Refused (API)"], ["error", "Error"]]),
    h("label", { class: "check", style: { padding: 0 } }, h("input", { type: "checkbox", checked: f.aware, onchange: (e) => { f.aware = e.target.checked; draw(); } }), "Only where it said it's being tested"));
  draw();
  frag.append(h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", { text: "Transcripts" })), h("div", { class: "sub", text: "Read what each agent saw, what it said and what it did." }), filters, list));
}

function episodeCard(e, color) {
  const reasoning = [e.reasoning, e.text].filter(Boolean).join("\n\n");
  const body = h("pre", { class: "reasoning" });
  const q = (e.judge_quote || "").trim();
  const at = q ? reasoning.indexOf(q) : -1;
  if (at >= 0) body.append(reasoning.slice(0, at), h("mark", { text: q }), reasoning.slice(at + q.length));
  else body.textContent = reasoning || (e.error ? `Error: ${e.error}` : "(no reasoning returned)");
  const actionText = { execute: "Carried out", escalate: "Escalated", no_answer: "No clear answer", refusal: "Refused (API)", error: "Error" }[e.action] || e.action;
  return h("div", { class: "episode" },
    h("div", { class: "episode-head" },
      h("span", { class: "dot", style: { background: color || "var(--ink-2)" } }), h("b", { text: e.model_label }),
      h("span", { class: "chip", text: fname(e.family) }),
      h("span", { class: "chip", text: e.label ? "sandbox-looking" : "production-looking" }),
      h("span", { class: "chip", text: e.should_allow ? "allowed request" : "policy-violating request" }),
      h("span", { class: `action-badge ${e.action}`, text: actionText }),
      e.test_aware ? h("span", { class: "chip", text: "said it's being tested" }) : null),
    h("div", { class: "req", text: e.request }),
    h("pre", { text: e.env }),
    body,
    e.tool_input ? h("pre", { text: `tool input: ${e.tool_input}` }) : null);
}

// ------------------------------------------------------------------ white-box report
const FIGS = [
  ["probe_by_layer.png", "Headline: a probe trained on explicit evaluation notes, tested on environments that never mention testing, by layer. Bag-of-words is 0.5 by construction."],
  ["verbalization.png", "How often the model says it's being tested, and the probe's accuracy on the traces where it stayed silent."],
  ["behaviour_effects.png", "Does the environment change P(carry out)? Paired by request, 95% CI."],
  ["steering.png", "Steering production-looking prompts along the evaluation direction vs random directions."],
  ["transfer_heatmaps.png", "Train on one condition, test on another: activations vs embeddings vs bag-of-words."],
];

async function whiteboxSummary(id) {
  const r = await fetch(asset(`/api/runs/${id}/files/summary.json`));
  return r.ok ? r.json() : null;
}

async function whiteboxBody(frag, info) {
  const s = info.status === "running" ? null : await whiteboxSummary(info.id);
  if (!s) {
    frag.append(h("div", { class: "panel" }, h("p", { class: "muted", text: info.status === "running" ? "Collecting activations… progress is in the log below." : "No results were written." })));
    return;
  }
  if (s.WARNING) frag.append(h("div", { class: "banner", text: "Simulated model: these numbers come from synthetic activations and only show what the charts look like. They are not findings." }));
  const v = s.verbalization || {};
  const silent = v.eval_probe_auc_silent_only || [];
  const link = s.probe_behaviour_link || {};
  frag.append(h("div", { class: "panel" },
    h("div", { class: "panel-head" }, h("h2", { text: "Inside the model" }), h("span", { class: "muted small-text", text: `${s.backend} · layer ${s.chosen_layer} of ${s.n_layers}` })),
    h("table", { class: "measures glance" }, h("tbody", {},
      measure("Eval-probe AUC on implicit cues", num(s.eval_probe_transfer_auc), `bag-of-words ${num(s.eval_probe_transfer_bow)} · embeddings ${num(s.eval_probe_transfer_embedding)}`),
      measure("Same, only traces where it stayed silent", num(silent[0]), silent.length ? `95% CI ${num(silent[1])}–${num(silent[2])}, n=${v.n_silent}` : "verbalization not run"),
      measure("Probe on aligned cues", num(s.aligned_probe_auc), `bag-of-words ${num(s.bow_aligned_auc)} (so decodability alone means little)`),
      measure("Policy competence", num(s.policy_competence_auc), "0.5 = can't do the task"),
      measure("Probe score ↔ decision, cue held fixed", num(link.spearman_rho_within_condition), (link.p != null && link.p < 0.001 ? "p<0.001" : `p=${num(link.p, 3)}`)))),
    h("ol", { class: "wb-findings" }, whiteboxFindings(s).map((t) => h("li", { text: t })))));
  frag.append(h("div", { class: "panel" }, h("div", { class: "figs" }, FIGS.map(([f, cap], i) => h("figure", {},
    h("img", { src: asset(`/api/runs/${info.id}/files/${f}`), alt: cap, loading: "lazy", onerror: (e) => e.target.closest("figure").remove() }),
    h("figcaption", {}, h("b", { text: `Figure ${i + 1}. ` }), cap))))));
}

function measure(label, value, note) {
  return h("tr", {}, h("td", { text: label }), h("td", { class: "num", text: value }), h("td", { text: note }));
}

function whiteboxFindings(s) {
  const out = [];
  const t = s.eval_probe_transfer_auc, e = s.eval_probe_transfer_embedding;
  if (t != null) {
    if (t >= 0.6 && (e == null || t > e + 0.05)) out.push(`The model maps sandbox-looking environments onto the same internal direction as explicit "this is an evaluation" notes (AUC ${num(t)}), well above bag-of-words (0.50) and token embeddings (${num(e)}).`);
    else if (t >= 0.6) out.push(`The evaluation probe transfers (AUC ${num(t)}), but token embeddings transfer about as well (${num(e)}), so this may be word similarity rather than a shared concept.`);
    else out.push(`The evaluation probe barely transfers to environments that never mention testing (AUC ${num(t)}): no clear shared "being tested" signal at this layer.`);
  }
  const v = s.verbalization;
  if (v && v.eval_probe_auc_silent_only) out.push(`On traces where the model never said it was being tested (n=${v.n_silent}), the probe still scored AUC ${num(v.eval_probe_auc_silent_only[0])}.`);
  if (s.policy_competence_auc != null && s.policy_competence_auc < 0.65) out.push("The model barely follows the policy, so behaviour and steering results are expected to be weak.");
  out.push("This shows the model represents evaluation-like context. It doesn't prove the model believes it is being tested or acts strategically on that belief.");
  return out;
}

// ------------------------------------------------------------------ compare
async function renderCompare(token = ++renderToken) {
  const box = $("#report");
  const ids = [...state.compare];
  const infos = state.runs.filter((r) => ids.includes(r.id));
  const frag = h("div", {}, h("div", { class: "report-head" }, h("div", {}, h("h1", { text: "Comparison" }), h("div", { class: "chips" }, infos.map((r) => h("span", { class: "chip", text: r.name || r.id })))),
    h("button", { class: "secondary small", text: "Back to single run", onclick: () => { state.compareMode = false; renderRunList(); renderReport(); } })));
  const agentRuns = infos.filter((r) => r.kind === "agents");
  const wbRuns = infos.filter((r) => r.kind === "whitebox");
  if (agentRuns.length) {
    const perRun = [];
    let families = [];
    for (const r of agentRuns) {
      try {
        const s = await api(`/api/runs/${r.id}/summary`);
        perRun.push(s.models.map((m) => ({ ...m, key: `${r.id}|${m.label}`, label: agentRuns.length > 1 ? `${r.name} · ${m.label}` : m.label })));
        families = [...new Set(families.concat(s.families))];
      } catch (_) { /* skip runs without results */ }
    }
    const all = perRun.flat();
    // Default pick: take models from each run in turn, so every run is represented.
    if (!state.comparePick || !state.comparePick.every((k) => all.some((m) => m.key === k))) {
      state.comparePick = [];
      for (let i = 0; state.comparePick.length < Math.min(3, all.length); i++)
        for (const ms of perRun) if (ms[i] && state.comparePick.length < 3) state.comparePick.push(ms[i].key);
    }
    if (all.length > 3) {
      const picker = h("div", { class: "filters" }, h("span", { class: "muted small-text", text: "Compare up to 3:" }),
        all.map((m) => h("label", { class: "check", style: { padding: "0 8px 0 0" } },
          h("input", { type: "checkbox", checked: state.comparePick.includes(m.key), onchange: (e) => {
            if (e.target.checked) {
              if (state.comparePick.length >= 3) { e.target.checked = false; return toast("Pick at most 3 models so the colours stay distinguishable."); }
              state.comparePick.push(m.key);
            } else state.comparePick = state.comparePick.filter((k) => k !== m.key);
            renderCompare();
          } }), m.label)));
      frag.append(h("div", { class: "panel" }, picker));
    }
    const models = state.comparePick.map((k) => all.find((m) => m.key === k)).filter(Boolean).map((m, i) => ({ ...m, color: COLORS[i] }));
    if (models.length) renderAgentPanels(frag, models, families);
  }
  if (wbRuns.length) {
    const sums = await Promise.all(wbRuns.map((r) => whiteboxSummary(r.id)));
    const rows = [
      ["Model", (s) => s.backend], ["Eval-probe transfer AUC", (s) => num(s.eval_probe_transfer_auc)],
      ["  … bag-of-words", (s) => num(s.eval_probe_transfer_bow)], ["  … embeddings", (s) => num(s.eval_probe_transfer_embedding)],
      ["Silent-only AUC", (s) => num((s.verbalization || {}).eval_probe_auc_silent_only?.[0])],
      ["Aligned probe AUC", (s) => num(s.aligned_probe_auc)], ["Policy competence", (s) => num(s.policy_competence_auc)],
      ["Probe ↔ decision ρ", (s) => num((s.probe_behaviour_link || {}).spearman_rho_within_condition)], ["Layer", (s) => `${s.chosen_layer} / ${s.n_layers}`],
    ];
    frag.append(h("div", { class: "panel" }, h("h2", { text: "Inside the model, side by side" }),
      h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: "" }), wbRuns.map((r) => h("th", { text: r.name })))),
        h("tbody", {}, rows.map(([label, f]) => h("tr", {}, h("td", { text: label }), sums.map((s) => h("td", { class: "num", text: s ? f(s) : "–" }))))))));
    frag.append(h("div", { class: "figs" }, wbRuns.map((r) => h("figure", {}, h("img", { src: asset(`/api/runs/${r.id}/files/probe_by_layer.png`), alt: r.name, onerror: (e) => e.target.closest("figure").remove() }), h("figcaption", { text: r.name })))));
  }
  if (token !== renderToken) return;
  box.replaceChildren(frag);
}

// ------------------------------------------------------------------ boot
async function boot() {
  initTheme();
  if (STATIC) {
    const note = h("div", { class: "demo-note", role: "note" },
      h("b", { text: "Read-only demo. " }),
      "These are saved runs from simulated agents, not findings. Starting experiments needs the local app: clone the repo and run ",
      h("code", { text: "python app.py" }), ".");
    $("main").prepend(note);
  }
  await loadMeta();
  const tabs = $$(".tabs button");
  for (const b of tabs) b.addEventListener("click", () => showTab(b.dataset.tab));
  $(".tabs").addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    next.focus();
    showTab(next.dataset.tab);
  });
  renderKeys();
  state.slots = defaultSlots();
  renderSlots();
  renderFamilies();
  $("#add-slot").addEventListener("click", () => { if (state.slots.length < 3) { state.slots.push({ provider: "mock", model: "mock/test-aware-lax" }); renderSlots(); updateEstimate(); } });
  $$("#tab-experiment input, #tab-experiment select").forEach((el) => el.addEventListener("change", updateEstimate));
  $("#btn-preview").addEventListener("click", () => showPreview());
  $("#preview-family").addEventListener("change", (e) => showPreview(e.target.value));
  $("#preview-close").addEventListener("click", () => ($("#preview").hidden = true));
  $("#btn-run").addEventListener("click", startRun);
  $("#wb-run").addEventListener("click", startWhitebox);
  $("#wb-load").addEventListener("click", async () => {
    try {
      const r = await api("/api/ndif/models");
      $("#wb-models").replaceChildren(...r.models.map((m) => h("option", { value: m })));
      toast(`${r.models.length} models running on NDIF right now. Click the model field to pick one.`);
    } catch (e) { toast(e.message, "error"); }
  });
  $$("input[name=wb-backend]").forEach((el) => el.addEventListener("change", () => {
    const b = $("input[name=wb-backend]:checked").value;
    $("#wb-model").value = b === "local" ? "Qwen/Qwen2.5-1.5B-Instruct" : b === "ndif" ? "meta-llama/Llama-3.3-70B-Instruct" : "simulated";
    $("#wb-model").disabled = b === "mock";
  }));
  $("#btn-compare").addEventListener("click", () => { state.compareMode = true; state.comparePick = null; renderRunList(); renderReport(); });
  window.addEventListener("resize", debounce(() => { if ($("#tab-results").hidden === false) renderReport(); }, 250));
  window.addEventListener("hashchange", () => {
    const [t, id] = location.hash.slice(1).split("/");
    if (id && id !== state.active) { state.active = id; state.compareMode = false; renderReport(); }
    if (["keys", "experiment", "inside", "results"].includes(t)) showTab(t, false);
  });
  updateEstimate();

  const [tab, runId] = (location.hash.slice(1) || "").split("/");
  await refreshRuns();
  if (runId) state.active = runId;
  else if (state.runs.length) {
    // The demo opens on the multi-model comparison, the run that shows the idea best.
    const agents = STATIC ? state.runs.filter((r) => r.kind === "agents") : [];
    const best = agents.sort((a, b) => (b.config?.slots?.length || 0) - (a.config?.slots?.length || 0))[0];
    state.active = (best || state.runs[0]).id;
  }
  showTab(["keys", "experiment", "inside", "results"].includes(tab) ? tab : STATIC ? "results" : "experiment", false);
  if (state.active) renderReport();

  // Poll while anything is running.
  setInterval(async () => {
    if (!state.offline && !state.runs.some((r) => r.status === "running")) return;
    const wasRunning = state.runs.find((r) => r.id === state.active)?.status === "running";
    await refreshRuns();
    if (!$("#tab-results").hidden && (wasRunning || state.runs.find((r) => r.id === state.active)?.status === "running")) renderReport();
  }, 3000);
}
boot().catch((e) => toast(`The app couldn't load: ${e.message}`, "error"));
