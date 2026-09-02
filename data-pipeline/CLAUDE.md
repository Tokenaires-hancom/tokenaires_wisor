# CLAUDE.md — data-pipeline

> 담당: 3번(재무데이터·투자 스타일 점수)
> 루트 `CLAUDE.md`의 규칙이 먼저 적용됩니다.

## 이 배치가 하는 일

재무 원천 → 파생 지표 → 스타일 점수 → 단일 `scores.json`.

로컬 기본 출력은 `apps/web/lib/generated/scores.json`이고, OCI에서는 `--out`으로 런타임
데이터 디렉터리의 후보 파일을 지정합니다. 화면은 이 JSON 하나만 읽으므로 여기서 나가는
값이 곧 사용자가 보는 값입니다. 출력은 같은 디렉터리의 임시 파일을 완성한 뒤 원자 교체합니다.

**두 가지 주기로 돕니다.** 수명이 다른 두 값을 한 실행에 묶지 않습니다.

| 모드 | 주기 | 하는 일 |
|---|---|---|
| `--mode full` | 하루 1회 | SEC 공시까지 다시 받아 재무를 새로 구성하고 `data/fundamentals.json`에 남깁니다 |
| `--mode prices` | 3시간마다 | 그 캐시를 읽어 토스 체결가만 덮어씁니다. SEC를 부르지 않습니다 |

재무는 분기에 한 번 바뀌고 가격은 3시간마다 바뀝니다. 가격 갱신에 SEC를 함께 부르면 종목당 두 번씩 380종목, 하루 여덟 번이면 6천 회가 넘습니다.

**캐시가 없으면 `--mode prices`는 실패합니다.** 조용히 전체 수집으로 되돌아가지 않습니다. 3시간마다 도는 작업이 어느 날 갑자기 SEC를 760번 두드리는 쪽이 더 위험합니다.

```
providers/base.py      공급자 인터페이스 · SampleProvider(예시 데이터)
providers/sec_toss.py  실데이터 공급자. SecTossProvider(전체 수집) · CachedPriceProvider(가격만)
metrics.py             원천 → 파생 지표
coverage.py            모델이 판정할 수 있는 업종. '정보 부족'과 '판정 대상 아님'을 가른다
quality.py             품질 게이트. 통과한 종목만 점수를 낸다
styles/base.py         기준 프레임워크
styles/*.py            버핏 1.0 · 그레이엄 1.0 · 린치 1.0 — 기준 통과의 가중합
                       그린블랫 1.0 — 마법공식 순위 합산. 구조가 다르다(RankedStyle)
run_batch.py           전체 실행
```

## 절대 규칙

**없는 값을 0으로 채우지 않습니다.** 이 파이프라인에서 가장 중요한 규칙입니다.

- `metrics.py`의 계산은 재료가 하나라도 없으면 `None`을 돌려줍니다
- `Criterion.test`가 `None`을 돌려주면 그 기준은 `unknown`이고, 점수의 **분모에서도 빠집니다**
- `unknown`이 25%를 넘으면 점수를 만들지 않고 '정보 부족'으로 표시합니다

데이터가 없는 것과 기준을 못 넘은 것은 사용자에게 전혀 다른 정보입니다. 이걸 뭉개면 재무 공시가 늦은 기업이 구조적으로 불리해집니다.

**버핏 모델의 기준은 8개로 고정입니다.** 기획서의 권장 문구("8개 기준 중 6개에 부합합니다")가 문자 그대로 성립해야 합니다. 개수를 바꾸려면 그 문구를 쓰는 화면과 테스트를 함께 고칩니다.

**`on_pass` / `on_fail` 문구는 사용자에게 그대로 나갑니다.**

## 기준을 새로 추가할 때

```python
Criterion(
    code="BUF_XXX",          # 스타일 접두사 + 의미. 한번 정하면 바꾸지 않는다(학습노트에 굳혀 저장됨)
    label="사람이 읽는 이름",
    weight=2,                # 1~3. 스타일 안에서 상대적 비중
    detail="ROIC ≥ 12%",     # 화면의 '계산 기준'에 그대로 노출
    test=lambda m: None if m.x is None else m.x >= 0.12,   # None = 판정 불가
    on_pass=lambda m: "...",  # 관찰 문장
    on_fail=lambda m: "...",  # 숨기지 않는다. 같은 비중으로 보여준다
)
```

`code`는 학습노트에 그 시점의 점수와 함께 굳혀 저장됩니다. 이미 나간 코드의 의미를 바꾸지 않습니다. 바꿔야 하면 새 코드를 만들고 모델 버전을 올립니다.

## 모델 버전

`Style.model_version`은 화면에 노출됩니다. 판정 결과가 달라지는 변경이면 반드시 올립니다.

- 문구만 다듬음 → 그대로
- 임계값·가중치·기준 변경 → 버전 표기를 올림
- 0.9는 초안 표기입니다. 상위 종목을 실제 공시와 대조 검수한 뒤 1.0으로 올립니다.
  네 모델은 검수를 마쳐 전부 1.0입니다 — 새 스타일을 만들 때 다시 쓰는 규칙입니다

## 실데이터 공급자

`SecTossProvider`가 붙어 있습니다 — SEC XBRL 공시(재무) + 토스증권(체결가) +
Nasdaq 스크리너(시가총액). 공급자를 새로 만들면 아래를 지킵니다.

- 미국 중·대형주, ETF·우선주·SPAC 제외, 은행·보험·리츠는 별도 분류(`coverage.py`)
- 최근 5개 회계연도가 모두 있는 종목만 통과. 빠진 해를 채워 넣지 않습니다
- 가격은 마지막 체결가. 받은 시각을 `asOf.priceAt`에 함께 남깁니다
- 반환 전 `quality.partition()`을 통과해야 합니다

## 확인

```bash
# 예시 데이터 12종목. 품질 리포트와 스타일별 상위 3종목이 출력된다
python run_batch.py --provider sample --universe data/universe_sample.json --out /tmp/sample-scores.json

# 실데이터. 전체 수집. 캐시를 새로 만든다
python run_batch.py --provider sec-toss --universe data/universe_us.json
# 체결가만 갱신. 3초면 끝난다
python run_batch.py --provider sec-toss --universe data/universe_us.json --mode prices

# OCI 정기 배치와 검증은 deploy/oci/bin/wisor-batch가 맡는다

pytest -q
```

**`--provider`와 `--universe`는 기본값이 없습니다.** 둘 다 안 주면 배치가 아예 시작하지
않습니다. 예전에는 `sample`과 `universe_sample.json`이 기본값이라, 옵션 없이 `run_batch.py`를
치면 실데이터 380종목이 예시 12종목으로 조용히 덮였습니다.

**예시 데이터는 `scores.json`에 쓸 수 없습니다.** `--provider sample`인데 `--out`이 화면이 읽는
경로면 배치가 거부합니다. 화면에 나가는 파일은 실데이터 배치만 씁니다.

실데이터는 항상 `--universe data/universe_us.json`을 붙입니다. `universe_sample.json`을 주면
`full`은 12종목만 수집하고, `prices`는 그중 캐시에 있는 종목만 갱신한 뒤 나머지는 조용히
옛 값을 유지합니다(`CachedPriceProvider.stale`).

운영 자동 갱신은 OCI의 `wisor-batch.timer`가 맡습니다. `.github/workflows/scores.yml`은
저장소의 생성 파일을 사람이 다시 만드는 수단인데, **지금은 동작하지 않습니다** — 토스 API가
송신 IP를 제한하고 허용 목록에 GitHub 러너 주소가 없어 토큰 발급이 403으로 막힙니다. 사정은
`docs/deploy.md`에 있습니다.

**배치가 막혔다고 timer를 멈추고 이 워크플로를 돌리지 마세요.** 지금 돌아가는 유일한 갱신
경로가 timer입니다.

추적 fallback을 갱신하는 릴리스에서는 `scores.json`을 함께 커밋합니다. OCI 정기 배치는
커밋하지 않고 `deploy/oci/bin/wisor-batch`가 이미지를 다시 만들어 게시합니다. 어느 경로든 상위 종목
몇 개는 눈으로 봅니다. **숫자가 통과했다고 결과가 말이 되는 것은 아닙니다.**
