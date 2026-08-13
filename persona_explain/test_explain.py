"""해설 텍스트 정돈(tidy) 검증 — 키 없이, 과금 없이 돈다.

연습장(playground.html)과 터미널은 응답을 raw text로 그린다. LLM이 붙이는
마크다운 표식(**굵게**), 굽은따옴표, 줄 끝 공백은 화면에 글자 그대로 남는다.
tidy()는 그걸 지운다.
"""

import safety
from explain import generate, tidy


class MarkdownAdapter:
    """마크다운 표식·굽은따옴표·줄 끝 공백을 붙여 답하는 가짜 어댑터."""

    def chat(self, system, messages, temperature=0.0):
        return (
            "- **자본 효율성**: **충족** → 좋은 편입니다.  \n"
            "“현금이 남는 사업”에 가깝습니다.  \n"
            "이 설명은 교육용이며 투자 조언이 아닙니다.  "
        )


def test_tidy_strips_bold_markers():
    assert tidy("**충족**") == "충족"
    assert tidy("__굵게__") == "굵게"
    assert tidy("- **자본 효율성**: 좋다") == "- 자본 효율성: 좋다"


def test_tidy_straightens_curly_quotes():
    assert tidy("“현금”") == '"현금"'
    assert tidy("‘버핏’") == "'버핏'"


def test_tidy_removes_trailing_whitespace():
    assert tidy("문장입니다.  \n다음 줄  ") == "문장입니다.\n다음 줄"


def test_tidy_keeps_arrows_and_bullets():
    # 화살표·불릿은 raw text로도 멀쩡히 보인다 — 건드리지 않는다.
    assert tidy("- 자본 효율성 → 충족") == "- 자본 효율성 → 충족"


def test_tidy_is_idempotent_on_clean_text():
    clean = "충족입니다.\n이 설명은 교육용이며 투자 조언이 아닙니다."
    assert tidy(clean) == clean


def test_generate_output_is_tidied():
    text, verdict, _ = generate(MarkdownAdapter(), "sys", [{"role": "user", "content": "q"}])
    assert verdict == safety.OK
    assert "**" not in text
    assert "“" not in text and "”" not in text
    # 줄 끝 공백이 남지 않는다
    assert all(line == line.rstrip() for line in text.splitlines())
