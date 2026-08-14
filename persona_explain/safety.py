"""출력 안전 필터 — LLM 해설에서 금지 표현을 사후 검사한다.

chart-api의 safety.py와 같은 이중 방어 사상:
- sentence 등급: 그 문장만 제거하고 나머지는 살린다.
- block 등급: 응답 전체를 폐기하고 재생성을 요청한다.
"""
import re

# (정규식, 등급) — block이 더 심각. 대소문자 무시.
_RULES = [
    (r"매수|매도|사세요|파세요|손절|익절", "block"),
    (r"목표\s*가|적정\s*주?가|목표\s*주가", "block"),
    (r"오를\s*것|내릴\s*것|상승할\s*것|하락할\s*것|바닥|천장", "block"),
    (r"저평가|고평가|투자\s*추천|매수\s*관점|수익\s*보장", "block"),
    (r"확실한\s*신호|반드시\s*오른", "block"),
]
_COMPILED = [(re.compile(p, re.IGNORECASE), sev) for p, sev in _RULES]

# 반환 verdict
OK = "ok"                 # 위반 없음
CLEANED = "cleaned"       # 문장 일부 제거함
REGENERATE = "regenerate" # block 위반 — 전체 재생성 필요


def _split_sentences(text: str):
    # 한국어 종결(다./요./음.) + 줄바꿈 기준 단순 분할.
    parts = re.split(r"(?<=[.!?\n])\s+", text)
    return [p for p in parts if p.strip()]


def check(text: str):
    """(verdict, cleaned_text, hits) 반환.

    - block 위반이 하나라도 있으면 REGENERATE (cleaned_text=None).
    - sentence 위반만 있으면 해당 문장 제거 후 CLEANED.
    - 없으면 OK.
    """
    hits = []
    has_block = False
    for rx, sev in _COMPILED:
        for m in rx.finditer(text):
            hits.append((m.group(0), sev))
            if sev == "block":
                has_block = True

    if not hits:
        return OK, text, hits

    if has_block:
        # 지금 규칙은 전부 block. 전체 폐기 후 재생성.
        return REGENERATE, None, hits

    # (향후 sentence 등급이 생기면) 위반 문장만 제거.
    kept = [s for s in _split_sentences(text)
            if not any(rx.search(s) for rx, sev in _COMPILED if sev == "sentence")]
    return CLEANED, " ".join(kept), hits
