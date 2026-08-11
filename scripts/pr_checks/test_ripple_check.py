from pathlib import Path

import ripple_check

PROMPT_PY = '''
LESSON_IDS = [
    "candle-basics",
    "trend-basics",
]
'''

CHART_LESSONS_TS = """
export const CHART_LESSONS = [
  {
    id: "candle-basics",
    title: "x",
  },
  {
    id: "trend-basics",
    title: "y",
  },
];
"""

CHART_LESSONS_TEST_TS = """
const EXPECTED_IDS = [
  "candle-basics",
  "trend-basics",
];
"""


def test_extract_string_list_reads_python_style_list():
    assert ripple_check.extract_string_list(PROMPT_PY, "LESSON_IDS") == [
        "candle-basics",
        "trend-basics",
    ]


def test_extract_string_list_reads_ts_style_list():
    assert ripple_check.extract_string_list(CHART_LESSONS_TEST_TS, "EXPECTED_IDS") == [
        "candle-basics",
        "trend-basics",
    ]


def test_extract_lesson_ids_reads_id_fields_in_order():
    assert ripple_check.extract_lesson_ids(CHART_LESSONS_TS) == [
        "candle-basics",
        "trend-basics",
    ]


def test_find_mismatches_returns_empty_when_all_three_match():
    assert (
        ripple_check.find_mismatches(
            ["candle-basics", "trend-basics"],
            ["candle-basics", "trend-basics"],
            ["candle-basics", "trend-basics"],
        )
        == []
    )


def test_find_mismatches_reports_id_missing_from_one_source():
    mismatches = ripple_check.find_mismatches(
        ["candle-basics", "trend-basics"],
        ["candle-basics"],
        ["candle-basics", "trend-basics"],
    )

    assert len(mismatches) == 1
    assert "chartLessons.ts" in mismatches[0]
    assert "trend-basics" in mismatches[0]


def test_real_repo_ids_match_across_all_three_sources():
    repo_root = Path(__file__).resolve().parents[2]
    prompt_py = (
        repo_root / "services/chart-api/app/services/prompt.py"
    ).read_text(encoding="utf-8")
    chart_lessons_ts = (
        repo_root / "apps/web/content/chartLessons.ts"
    ).read_text(encoding="utf-8")
    chart_lessons_test_ts = (
        repo_root / "apps/web/content/chartLessons.test.ts"
    ).read_text(encoding="utf-8")

    lesson_ids = ripple_check.extract_string_list(prompt_py, "LESSON_IDS")
    chart_ids = ripple_check.extract_lesson_ids(chart_lessons_ts)
    expected_ids = ripple_check.extract_string_list(chart_lessons_test_ts, "EXPECTED_IDS")

    assert ripple_check.find_mismatches(lesson_ids, chart_ids, expected_ids) == []
    assert len(lesson_ids) == 5
