import pr_format_check as fc


def test_title_with_valid_prefix_passes():
    assert fc.check_title("fix: 배우기 카드 정렬을 다듬는다") == []


def test_title_without_prefix_flagged():
    assert fc.check_title("Update README.md") != []


def test_title_with_unknown_prefix_flagged():
    assert fc.check_title("release: 배포 준비") != []


def test_title_with_prefix_but_no_description_flagged():
    assert fc.check_title("fix:") != []


BODY_ALL_FILLED = """\
## 무엇을 바꿨는지

디자인 규칙을 정리했다.

## 왜

새 디자인과 충돌해서.

## 어떻게 확인했는지

로컬에서 npm run build 통과 확인.
"""


def test_body_with_all_sections_filled_passes():
    assert fc.check_body(BODY_ALL_FILLED) == []


def test_body_with_empty_section_flagged():
    body = """\
## 무엇을 바꿨는지

디자인 규칙을 정리했다.

## 왜

## 어떻게 확인했는지

로컬에서 npm run build 통과 확인.
"""
    violations = fc.check_body(body)
    assert len(violations) == 1
    assert "왜" in violations[0]


def test_body_missing_section_flagged():
    body = """\
## 무엇을 바꿨는지

디자인 규칙을 정리했다.
"""
    violations = fc.check_body(body)
    assert len(violations) == 2


def test_body_empty_string_flags_all_three():
    assert len(fc.check_body("")) == 3
