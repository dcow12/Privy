"""Probes and statistics. Every split is leave-task-out (GroupKFold by task)."""
from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def probe():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=2000))


def safe_auc(y, s):
    y, s = np.asarray(y), np.asarray(s)
    ok = ~np.isnan(s)
    if ok.sum() < 4 or len(np.unique(y[ok])) < 2:
        return float("nan")
    return float(roc_auc_score(y[ok], s[ok]))


def cv_scores(X, y, groups, n_splits=5):
    """Out-of-fold probe scores: each row is scored by a probe that never saw its task."""
    scores = np.zeros(len(y))
    for tr, te in GroupKFold(n_splits).split(X, y, groups):
        scores[te] = probe().fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return scores


def cv_auc(X, y, groups, n_splits=5):
    return safe_auc(y, cv_scores(X, y, groups, n_splits))


def transfer_scores(X, df, train_mask, target_mask, n_splits=5):
    """Train on `train_mask` rows of some tasks, score `target_mask` rows of the held-out tasks.

    Returns one score per row of df (NaN outside target_mask).
    """
    tasks = df.task_id.to_numpy()
    y = df.label.to_numpy()
    uniq = np.unique(tasks)
    out = np.full(len(df), np.nan)
    for tr_t, te_t in GroupKFold(n_splits).split(uniq, groups=uniq):
        tr = train_mask & np.isin(tasks, uniq[tr_t])
        te = target_mask & np.isin(tasks, uniq[te_t])
        if te.any():
            out[te] = probe().fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return out


def transfer_auc(X, df, fam_a, fam_b, n_splits=5):
    fam = df.family.to_numpy()
    s = transfer_scores(X, df, fam == fam_a, fam == fam_b, n_splits)
    keep = fam == fam_b
    return safe_auc(df.label.to_numpy()[keep], s[keep])


def transfer_matrix(X, df, fams):
    return np.array([[transfer_auc(X, df, a, b) for b in fams] for a in fams])


def bow_features(texts):
    vec = CountVectorizer(token_pattern=r"[A-Za-z_]+", binary=True)
    return vec.fit_transform(texts).toarray().astype(float)


def bootstrap_ci(x, n=2000, seed=0):
    rng = np.random.default_rng(seed)
    x = np.asarray(x, dtype=float)
    x = x[~np.isnan(x)]
    if len(x) == 0:
        return float("nan"), float("nan"), float("nan")
    means = rng.choice(x, (n, len(x)), replace=True).mean(1)
    return float(x.mean()), float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def bootstrap_auc_ci(y, s, groups, n=1000, seed=0):
    """AUC with a CI from resampling whole tasks (rows within a task aren't independent)."""
    y, s, groups = map(np.asarray, (y, s, groups))
    point = safe_auc(y, s)
    rng = np.random.default_rng(seed)
    uniq = np.unique(groups)
    boots = []
    for _ in range(n):
        pick = rng.choice(uniq, len(uniq), replace=True)
        idx = np.concatenate([np.where(groups == g)[0] for g in pick])
        a = safe_auc(y[idx], s[idx])
        if not np.isnan(a):
            boots.append(a)
    if not boots:
        return point, float("nan"), float("nan")
    return point, float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))


def paired_effect(d, value, n_boot=2000):
    """Mean over tasks of (sandbox-side mean - prod-side mean), with a bootstrap CI over tasks."""
    per_task = d.groupby(["task_id", "label"])[value].mean().unstack()
    if 0 not in per_task or 1 not in per_task:
        return float("nan"), float("nan"), float("nan"), 0
    diff = (per_task[1] - per_task[0]).dropna().to_numpy()
    m, lo, hi = bootstrap_ci(diff, n_boot)
    return m, lo, hi, len(diff)


def stratified_sample(df, keys, n_per_cell, seed=0):
    """Up to n_per_cell rows from every combination of `keys` (keeps all columns)."""
    idx = []
    for _, grp in df.groupby(keys):
        idx += grp.sample(min(n_per_cell, len(grp)), random_state=seed).index.tolist()
    return df.loc[idx]


def logit(p, eps=1e-4):
    p = np.clip(np.asarray(p, dtype=float), eps, 1 - eps)
    return np.log(p / (1 - p))
