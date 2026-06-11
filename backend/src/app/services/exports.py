"""Evaluation-run exports: xlsx (openpyxl) and PDF (reportlab + DejaVu fonts)."""

import io
import re
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app import models
from app.paths import FONTS_DIR
from app.translations import tr

_INVALID_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")

#: Leading characters Excel interprets as a formula (OWASP CSV/formula injection).
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_cell(value: Any) -> Any:
    """Neutralize formula injection: user text starting like a formula stays text."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _sanitize_row(row: list[Any]) -> list[Any]:
    return [_sanitize_cell(value) for value in row]


def _region_name(result: models.EvaluationResult, lang: str) -> str:
    return result.region_name_uk if lang == "uk" else result.region_name_en


def _risk_label(risk_class: str, lang: str) -> str:
    return f"{risk_class} — {tr(lang, risk_class)}"


def _summary_header(lang: str) -> list[str]:
    return [
        tr(lang, "region"),
        tr(lang, "n_respondents"),
        tr(lang, "xi"),
        tr(lang, "delta_level"),
        tr(lang, "delta"),
        tr(lang, "phi"),
        tr(lang, "m_s"),
        tr(lang, "omega"),
        tr(lang, "mu"),
        tr(lang, "risk_class"),
    ]


def _summary_row(result: models.EvaluationResult, lang: str) -> list[Any]:
    return [
        _region_name(result, lang),
        result.n,
        result.xi,
        result.delta_level,
        round(result.delta, 2),
        round(result.phi, 4),
        round(result.m_s, 4),
        round(result.omega, 2),
        round(result.mu, 4),
        _risk_label(result.risk_class, lang),
    ]


def _group_codes(result: models.EvaluationResult) -> list[str]:
    if result.individuals:
        return list(result.individuals[0]["theta"].keys())
    return []


def _sheet_title(name: str, used: set[str]) -> str:
    title = _INVALID_SHEET_CHARS.sub(" ", name).strip()[:31] or "Region"
    base, counter = title, 2
    while title in used:
        suffix = f" ({counter})"
        title = base[: 31 - len(suffix)] + suffix
        counter += 1
    used.add(title)
    return title


def build_xlsx(run: models.EvaluationRun, lang: str) -> bytes:
    workbook = Workbook()
    summary = workbook.active
    summary.title = _INVALID_SHEET_CHARS.sub(" ", tr(lang, "summary"))[:31]
    bold = Font(bold=True)

    summary.append(_summary_header(lang))
    for cell in summary[1]:
        cell.font = bold
    for result in run.results:
        summary.append(_sanitize_row(_summary_row(result, lang)))

    used_titles = {summary.title}
    for result in run.results:
        sheet = workbook.create_sheet(_sheet_title(_region_name(result, lang), used_titles))
        group_codes = _group_codes(result)
        header = (
            [tr(lang, "respondent"), tr(lang, "ext_id")]
            + [f"{tr(lang, 'theta_prefix')}({code})" for code in group_codes]
            + [f"{tr(lang, 'term_prefix')}({code})" for code in group_codes]
            + [tr(lang, "r_star"), tr(lang, "chi")]
        )
        sheet.append(header)
        for cell in sheet[1]:
            cell.font = bold
        for individual in result.individuals:
            sheet.append(
                _sanitize_row(
                    [individual["respondent_id"], individual["ext_id"]]
                    + [individual["theta"][code] for code in group_codes]
                    + [individual["terms"][code] for code in group_codes]
                    + [individual["r_star"], individual["chi"]]
                )
            )

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


_FONT_REGULAR = "DejaVuSans"
_FONT_BOLD = "DejaVuSans-Bold"


def _register_fonts() -> None:
    registered = pdfmetrics.getRegisteredFontNames()
    if _FONT_REGULAR not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_REGULAR, str(FONTS_DIR / "DejaVuSans.ttf")))
    if _FONT_BOLD not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_BOLD, str(FONTS_DIR / "DejaVuSans-Bold.ttf")))


def _params_rows(params: dict[str, Any], lang: str) -> list[list[str]]:
    chi_scale = params.get("chi_scale", {})
    z_spline = params.get("z_spline", {})
    cone = params.get("cone", {})
    return [
        [
            tr(lang, "term_multipliers"),
            ", ".join(str(v) for v in params.get("term_multipliers", [])),
        ],
        [
            tr(lang, "chi_scale"),
            ", ".join(f"{k}: {v}" for k, v in chi_scale.items()),
        ],
        [
            tr(lang, "z_spline_params"),
            f"a = {z_spline.get('a')}, b = {z_spline.get('b')}",
        ],
        [
            tr(lang, "cone_params"),
            f"{tuple(cone.get('base', []))}, {tuple(cone.get('scale', []))}",
        ],
        [
            tr(lang, "fuzz_boundaries"),
            ", ".join(str(v) for v in params.get("fuzzification_boundaries", [])),
        ],
        [
            tr(lang, "risk_thresholds"),
            ", ".join(str(v) for v in params.get("risk_thresholds", [])),
        ],
    ]


def build_pdf(run: models.EvaluationRun, lang: str) -> bytes:
    _register_fonts()
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=tr(lang, "report_title"),
    )
    title_style = ParagraphStyle("Title", fontName=_FONT_BOLD, fontSize=14, leading=18)
    heading_style = ParagraphStyle(
        "Heading", fontName=_FONT_BOLD, fontSize=11, leading=15, spaceBefore=8
    )
    body_style = ParagraphStyle("Body", fontName=_FONT_REGULAR, fontSize=9, leading=13)

    grid_style = TableStyle(
        [
            ("FONTNAME", (0, 0), (-1, -1), _FONT_REGULAR),
            ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )

    story: list[Any] = [
        Paragraph(tr(lang, "report_title"), title_style),
        Spacer(1, 4 * mm),
        Paragraph(
            f"{tr(lang, 'run')} #{run.id} — {tr(lang, 'created_at')}: "
            f"{run.created_at:%Y-%m-%d %H:%M} UTC",
            body_style,
        ),
    ]
    if run.comment:
        story.append(Paragraph(f"{tr(lang, 'comment')}: {run.comment}", body_style))

    story.append(Paragraph(tr(lang, "summary"), heading_style))
    summary_data = [_summary_header(lang)] + [
        [str(value) for value in _summary_row(result, lang)] for result in run.results
    ]
    story.append(Table(summary_data, style=grid_style, repeatRows=1))

    story.append(Paragraph(tr(lang, "interpretation"), heading_style))
    for result in run.results:
        story.append(
            Paragraph(
                tr(lang, "interpretation_line").format(
                    region=_region_name(result, lang),
                    mu=round(result.mu, 4),
                    risk=result.risk_class,
                    label=tr(lang, result.risk_class),
                ),
                body_style,
            )
        )

    story.append(Paragraph(tr(lang, "parameters"), heading_style))
    story.append(Table(_params_rows(run.config_snapshot, lang), style=grid_style))

    story.append(Paragraph(tr(lang, "ruleset"), heading_style))
    ruleset = run.ruleset_snapshot
    for index, rule in enumerate(ruleset.get("rules", []), start=1):
        pattern = ", ".join(f"T{level}" for level in rule["pattern"])
        story.append(
            Paragraph(
                f"{tr(lang, 'rule')} {index}: {tr(lang, 'rule_if')} [{pattern}] "
                f"{tr(lang, 'rule_then')} {rule['output']} ({tr(lang, rule['output'])})",
                body_style,
            )
        )
    default_output = ruleset.get("default_output", "H")
    story.append(
        Paragraph(
            f"{tr(lang, 'default_output')}: {default_output} ({tr(lang, default_output)})",
            body_style,
        )
    )

    document.build(story)
    return buffer.getvalue()
