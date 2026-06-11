# tourism-risk

**Computational core for tourism travel safety risk assessment** — a pure-Python
(zero-dependency) implementation of the fuzzy multi-level risk model from the
intelligent analytical platform for assessing the safety risk of tourist travel
(PhD thesis chapter 4 / the 2025 article, eq. 4.2–4.9).

The library computes the quantitative ($\mu_R$) and linguistic ($T_R$) safety
risk assessment of a tourist region from questionnaire data, implementing the
operator

$$
T_5(R, E, \Xi, \Delta, M_I, M_{R1}, M_{R2}, M_{R3}) \rightarrow Y(f_5) = \{\mu_R, T_R\}
$$

where $R$ is the set of regions, $E$ the set of respondents (tourism
participants), $\Xi(R) \in [0,1]$ the predicted level of repeat visits,
$\Delta(R)$ the expert safety level of the regional tourism system, and
$M_I, M_{R1}, M_{R2}, M_{R3}$ the four computation modules described below.

It is the engine behind the web platform of the same project, but has **no
dependency on any web layer** — researchers and tourism managers can apply it
directly in their own computations.

## The pipeline

### M_I — information module (eq. 4.2)

Each respondent rates criteria on a five-point linguistic scale
$l_1$ "completely disagree" … $l_5$ "completely agree", mapped numerically as
$\tau(l_k) = k$. Criteria are organised into configurable groups (article
preset: $G_1$ infrastructure safety, 5 criteria $K_{11}..K_{15}$; $G_2$ social
and ecological safety, 7 criteria $K_{21}..K_{27}$; $G_3$ medical safety,
5 criteria $K_{31}..K_{35}$). Per group:

$$\theta_g = \sum_{i=1}^{m_g} \tau_{gi}$$

### M_R1 — individual level (eq. 4.3–4.4)

A characteristic function converts $\theta_g$ to a term level $T_1..T_5$ using
boundaries that are multiples of the group size $m_g$ (default multipliers
1, 2, 3, 4):

$$
T_g = \begin{cases}
T_1 & \theta_g < m_g \\
T_2 & m_g \le \theta_g < 2m_g \\
T_3 & 2m_g \le \theta_g < 3m_g \\
T_4 & 3m_g \le \theta_g < 4m_g \\
T_5 & \theta_g \ge 4m_g
\end{cases}
$$

Group terms are aggregated into the individual risk term
$r^*(e) \in \{L, BA, A, AA, H\}$ (low → high risk) by ordered "If–Then" rules.
Each rule is a multiset of minimum term levels; it fires iff the group terms
can be assigned **injectively** to the slots, each term ≥ its slot level.
Rules are evaluated top-down, first match wins; the default output is $H$.
Article preset: $[T_5,T_4,T_4] \to L$; $[T_5,T_4,T_3] \to BA$;
$[T_4,T_3,T_2] \to A$; $[T_3,T_2,T_2] \to AA$; else $H$.

### M_R2 — regional level (eq. 4.5–4.7)

Risk terms map to a percentage scale $\chi$ (default $L\to15$, $BA\to30$,
$A\to50$, $AA\to80$, $H\to100$) and average into the regional value

$$\delta(R) = \frac{1}{n}\sum_{j=1}^{n} \chi(e_j)$$

(optionally a weighted mean). A quadratic Z-spline with parameters $a=60$,
$b=100$ produces $\varphi(R)$:

$$
\varphi(\delta) = \begin{cases}
1 & \delta \le a \\
1 - \dfrac{(\delta - a)^2}{2\left(\frac{b-a}{2}\right)^2} & a < \delta \le \frac{a+b}{2} \\
\dfrac{(b - \delta)^2}{2\left(\frac{b-a}{2}\right)^2} & \frac{a+b}{2} < \delta < b \\
0 & \delta \ge b
\end{cases}
$$

A cone-shaped membership function combines $\varphi(R)$ with the DM-entered
$\Xi(R)$ into the regional feeling-of-safety level:

$$m_S(R) = 1 - \frac{1}{2}\sqrt{(\varphi(R) - 1)^2 + (\Xi(R) - 1)^2}$$

### M_R3 — national level (eq. 4.8–4.9)

With interval boundaries $a_1..a_6 = (0, 20, 40, 60, 80, 100)$ and the expert
level $\Delta(R) = \Delta_k$, fuzzification gives

$$\omega(R) = a_{k+1} \cdot m_S(R)$$

and an S-shaped membership function the final quantitative estimate:

$$
\mu_R(\omega) = \begin{cases}
0 & \omega \le a_1 \\
2\left(\dfrac{\omega - a_1}{a_6 - a_1}\right)^2 & a_1 < \omega \le \frac{a_1+a_6}{2} \\
1 - 2\left(\dfrac{a_6 - \omega}{a_6 - a_1}\right)^2 & \frac{a_1+a_6}{2} < \omega < a_6 \\
1 & \omega \ge a_6
\end{cases}
$$

$\mu_R$ is interpreted linguistically: $[0, 0.2) \to R_1$ very high risk,
$[0.2, 0.4) \to R_2$ high, $[0.4, 0.6) \to R_3$ medium, $[0.6, 0.8) \to R_4$
low, $[0.8, 1] \to R_5$ very low risk.

## Installation

> PyPI publication is pending; once published:

```bash
pip install tourism-risk
```

or, with [uv](https://docs.astral.sh/uv/):

```bash
uv add tourism-risk
```

Until then, install from source (from the repository root):

```bash
uv pip install ./core        # or: pip install ./core
```

Requires Python ≥ 3.12. No runtime dependencies.

## Usage: reproducing the article's worked example

The article evaluates three control respondents and three regions
($R_1$ Zakarpattia, $R_2$ Ivano-Frankivsk, $R_3$ Lviv oblast). Individual
level, end to end:

```python
from tourism_risk import DEFAULT_CONFIG, evaluate_respondent

# Ratings in group order: K11..K15, K21..K27, K31..K35
e1 = [5, 5, 1, 1, 1] + [1] * 7 + [2, 2, 2, 1, 1]
e210 = [4, 2, 2, 2, 2] + [2, 2, 3, 2, 3, 2, 1] + [2, 3, 3, 4, 5]
e251 = [1, 1, 2, 1, 2] + [1, 1, 2, 1, 2, 3, 3] + [1, 2, 4, 2, 3]

for name, ratings in [("e1", e1), ("e210", e210), ("e251", e251)]:
    result = evaluate_respondent(ratings, DEFAULT_CONFIG)
    print(name, result.theta, result.group_terms, result.risk_term.name)
```

Expected output (matches article Table 1):

```
e1 (13, 7, 8) (3, 2, 2) AA
e210 (12, 15, 17) (3, 3, 4) A
e251 (7, 13, 12) (2, 2, 3) AA
```

Regional and national level, feeding the article's published step values:

```python
from tourism_risk import (
    DEFAULT_CONFIG, cone_membership, omega, risk_class, s_membership, z_spline,
)

# R1 Zakarpattia: published delta = 79.54, Xi = 0.85, expert level Delta_5
phi = z_spline(79.54, a=60.0, b=100.0)                # eq. 4.6 -> 0.5227355
m_s = cone_membership(phi=0.5, xi=0.85)               # eq. 4.7 (article carries phi rounded to 0.5)
w = omega(0.74, 5, DEFAULT_CONFIG.fuzz_boundaries)    # eq. 4.8
mu = s_membership(74.0, 0.0, 100.0)                   # eq. 4.9
t_r = risk_class(mu, DEFAULT_CONFIG.risk_thresholds)

print(f"m_S = {m_s:.2f}, omega = {w:.0f}, mu_R = {mu:.4f}, class = {t_r.name}")
```

Expected output (matches the published chain $m_S=0.74$, $\omega=74$,
$\mu_R=0.86$, $R_5$ — very low risk):

```
m_S = 0.74, omega = 74, mu_R = 0.8648, class = R5
```

Or evaluate a whole region in one call, with every intermediate retained:

```python
from tourism_risk import DEFAULT_CONFIG, evaluate_region

region = evaluate_region(
    respondent_ratings=[e1, e210, e251],
    xi=0.85,            # predicted level of repeat visits (DM input)
    delta_level=5,      # expert safety level Delta_5 (DM input)
    config=DEFAULT_CONFIG,
)
print(region.delta)            # 70.0      (eq. 4.5)
print(region.phi)              # 0.875     (eq. 4.6)
print(round(region.m_s, 4))    # 0.9024    (eq. 4.7)
print(round(region.omega, 2))  # 90.24     (eq. 4.8)
print(round(region.mu, 4))     # 0.9809    (eq. 4.9)
print(region.risk_class.name)  # R5 (very low risk)
```

## Customising the model

Every constant of the model is a field of the frozen `ModelConfig` — criteria
groups, rule set, term boundaries, the $\chi$ scale, Z-spline parameters,
cone base/scale, interval boundaries $a_1..a_6$ and risk-class thresholds:

```python
import dataclasses

from tourism_risk import (
    DEFAULT_CONFIG, CriteriaGroup, ModelConfig, RiskTerm, Rule, RuleSet,
    evaluate_region,
)

# A stricter rule set (the article's prose variant of rule 4: two groups at T3)
strict_rules = RuleSet(
    rules=(
        Rule(pattern=(5, 4, 4), output=RiskTerm.L),
        Rule(pattern=(5, 4, 3), output=RiskTerm.BA),
        Rule(pattern=(4, 3, 2), output=RiskTerm.A),
        Rule(pattern=(3, 3, 2), output=RiskTerm.AA),
    ),
    default=RiskTerm.H,
)
strict_config = dataclasses.replace(DEFAULT_CONFIG, rules=strict_rules)

# Or a fully custom model: two criteria groups and a shifted chi scale
custom_config = ModelConfig(
    groups=(
        CriteriaGroup(id="G1", name="Transport", criteria=("C1", "C2", "C3")),
        CriteriaGroup(id="G2", name="Health", criteria=("C4", "C5", "C6", "C7")),
    ),
    rules=RuleSet(
        rules=(
            Rule(pattern=(5, 4), output=RiskTerm.L),
            Rule(pattern=(4, 3), output=RiskTerm.A),
        ),
        default=RiskTerm.H,
    ),
    chi_scale=(10.0, 30.0, 50.0, 70.0, 90.0),
    zspline_a=50.0,
    zspline_b=90.0,
)

result = evaluate_region(
    respondent_ratings=[[5, 5, 4, 4, 4, 5, 4]],
    xi=0.9,
    delta_level=4,
    config=custom_config,
)
print(result.risk_class.name)
```

Inputs are validated with clear `ValueError`s: ratings must be integers 1–5
with the exact criteria count, $\Xi \in [0, 1]$, boundaries strictly
increasing, rule patterns non-empty with levels 1–5 and at most one slot per
criteria group.

## Publishing (maintainers)

Build the sdist + wheel and upload to PyPI with uv (from the repo root):

```bash
uv build --project core --out-dir core/dist
uv publish core/dist/*
```

`uv publish` authenticates with a PyPI API token — set the
`UV_PUBLISH_TOKEN` environment variable or pass `--token`. Bump `version` in
`core/pyproject.toml` (and `CITATION.cff`) before building.

## Citation

If you use this library in academic work, please cite the article:

> Shafar, A. (2025). Intellectual-analytical platform for assessing the
> security risk of tourist travel. *Scientific Journal of Ternopil National
> Technical University, 120*(4), 78–89.
> https://doi.org/10.33108/visnyk_tntu2025.04.078

and the software itself (see
[`CITATION.cff`](https://github.com/Reidond/travel-risk-platform/blob/main/core/CITATION.cff)):

> Shafar, A. (2026). *tourism-risk: Intelligent analytical platform for
> tourism travel safety risk assessment* (Version 0.1.0) [Computer software].

## License

[MIT](https://github.com/Reidond/travel-risk-platform/blob/main/core/LICENSE)
© 2026 Andrii Shafar
