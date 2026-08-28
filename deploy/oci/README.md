# OCI 런타임 데이터 배포

가격·재무 데이터 갱신은 애플리케이션 이미지를 다시 만들지 않습니다. 최초 전환 때만 Web과
Persona 이미지를 한 번 빌드하고, 이후에는 호스트의 `scores.json`을 원자 교체합니다.

> 이 저장소에는 OCI 서버의 기존 base Compose·Dockerfile·Nginx 설정이 없습니다. 아래의
> `BASE_COMPOSE` 경로, `web`/`persona` 서비스명, 내부 URL은 서버에서 확인한 뒤 사용합니다.
> `docker compose config`와 canary가 통과하기 전에는 timer를 활성화하지 않습니다.

## 1. 기존 서버 구성 확인

```bash
cd /opt/wisor/current
BASE_COMPOSE=/실제/경로/compose.yaml
docker compose -f "$BASE_COMPOSE" config --services
curl -fsS http://127.0.0.1/ >/dev/null
curl -fsS http://127.0.0.1/api/persona/health
sudo systemctl disable --now wisor-batch.timer 2>/dev/null || true
systemctl --no-pager --full list-units 'wisor-batch*.service'
docker compose -f "$BASE_COMPOSE" images
```

위 두 기존 URL이 현재 Nginx 구성에서 열리지 않으면 실제 로컬 포트·경로를 확인해
`/etc/wisor/batch.env`의 검증 URL을 바꿉니다. Compose 서비스명이 다르면
`compose.runtime.yaml`의 `web`·`persona` 키도 실제 이름으로 바꿉니다.
기존 batch service가 실행 중이면 끝날 때까지 기다리고, 현재 image ID와 base Compose 경로를
기록한 뒤 전환합니다. 실서버 구성을 확인하기 전에는 아래 명령을 그대로 실행하지 않습니다.

## 2. 런타임 파일과 배치 캐시 준비

Compose를 올리기 **전에** bind mount 원본을 만듭니다. 런타임 데이터는 공개 정보라 컨테이너
UID와 무관하게 읽을 수 있도록 디렉터리는 0755, 배치 상태는 0750으로 둡니다.

```bash
sudo install -d -o ubuntu -g ubuntu -m 0755 /var/lib/wisor/runtime
sudo install -d -o ubuntu -g ubuntu -m 0750 /var/lib/wisor/batch
sudo install -o ubuntu -g ubuntu -m 0644 \
  apps/web/lib/generated/scores.json /var/lib/wisor/runtime/scores.json
sudo install -o ubuntu -g ubuntu -m 0640 \
  data-pipeline/data/fundamentals.json /var/lib/wisor/batch/fundamentals.json
```

비밀 환경 파일은 root만 읽게 만듭니다. 기존에 사용하던 실제 자격증명 값을 넣습니다.

```bash
sudo install -d -o root -g root -m 0750 /etc/wisor
sudoedit /etc/wisor/batch.env
sudo chmod 0600 /etc/wisor/batch.env
```

```ini
TOSS_INVEST_CLIENT_ID=실제값
TOSS_INVEST_CLIENT_SECRET=실제값
WISOR_SEC_USER_AGENT=실제값
WISOR_REPO_DIR=/opt/wisor/current
WISOR_PYTHON=/opt/wisor/venv/bin/python
WISOR_RUNTIME_DIR=/var/lib/wisor/runtime
WISOR_BATCH_STATE_DIR=/var/lib/wisor/batch
WISOR_MINIMUM_COMPANIES=300
WISOR_MAXIMUM_COMPANY_DROP=8
WISOR_MINIMUM_PRICE_REFRESH_RATIO=0.95
WISOR_WEB_VERSION_URL=http://127.0.0.1/api/data-version
WISOR_PERSONA_META_URL=http://127.0.0.1/api/persona/meta
```

## 3. 컨테이너를 런타임 파일에 연결

```bash
export WISOR_RUNTIME_DIR=/var/lib/wisor/runtime
docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml config --quiet
docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml up -d --build
docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml exec web \
  test -r /runtime/scores.json
docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml exec persona \
  test -r /runtime/scores.json
curl -fsS http://127.0.0.1/api/data-version
curl -fsS http://127.0.0.1/api/persona/meta
```

**파일 하나가 아니라 부모 디렉터리를 bind mount합니다.** 원자 교체는 inode를 바꾸므로 단일
파일 mount는 이전 파일을 계속 가리킬 수 있습니다. `--build`는 이 최초 전환에만 필요합니다.

## 4. unit 설치와 수동 canary

unit은 먼저 설치만 합니다. `Persistent=true` timer를 곧바로 켜면 과거 실행을 보충하려고
canary 전에 배치가 시작될 수 있습니다.

```bash
sudo install -m 0644 deploy/oci/systemd/wisor-batch@.service /etc/systemd/system/
sudo install -m 0644 deploy/oci/systemd/wisor-batch.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemd-analyze verify \
  /etc/systemd/system/wisor-batch@.service \
  /etc/systemd/system/wisor-batch.timer
sudo systemctl disable --now wisor-batch.timer
```

컨테이너 시작 시각을 저장한 뒤 `full`, `prices` 순서로 한 번씩 검증합니다. 실제 서비스명으로
`web`·`persona`를 고칩니다.

```bash
web_id="$(docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml ps -q web)"
persona_id="$(docker compose -f "$BASE_COMPOSE" -f deploy/oci/compose.runtime.yaml ps -q persona)"
web_started="$(docker inspect -f '{{.State.StartedAt}}' "$web_id")"
persona_started="$(docker inspect -f '{{.State.StartedAt}}' "$persona_id")"

sudo systemctl start wisor-batch@full.service
sudo journalctl -u wisor-batch@full.service -n 100 --no-pager
sudo systemctl start wisor-batch@prices.service
sudo journalctl -u wisor-batch@prices.service -n 100 --no-pager

test "$web_started" = "$(docker inspect -f '{{.State.StartedAt}}' "$web_id")"
test "$persona_started" = "$(docker inspect -f '{{.State.StartedAt}}' "$persona_id")"
curl -fsS http://127.0.0.1/api/data-version
curl -fsS http://127.0.0.1/api/persona/meta
```

두 unit이 성공하고 컨테이너 시작 시각이 그대로일 때만 timer를 켭니다.

```bash
sudo systemctl enable --now wisor-batch.timer
systemctl list-timers wisor-batch.timer
```

## 동작과 안전선

`auto`는 KST 01·04·07·10·13·16·19·22시에 실행됩니다. KST 16시 이후 그날 처음 성공하는
실행만 `full`이고 나머지는 `prices`입니다. `full`이 실패하면 다음 실행에서 다시 시도합니다.

1. `flock`으로 서버 안의 중복 실행을 막습니다.
2. 가격과 시가총액을 모두 새로 받은 종목이 95% 미만이면 게시하지 않습니다.
3. 종목 수가 직전 정상본보다 8개 넘게 줄거나 300개 미만이면 게시하지 않습니다.
4. 후보 JSON과 full 재무 캐시를 별도 파일에서 완성·검증합니다.
5. `scores.json`을 원자 교체한 뒤 metadata와 홈·스크리너·종목 상세를 실제 호출합니다.
6. 실패·SIGTERM·timeout이면 이전 `scores.json`을 원자 복원합니다.
7. canary가 성공한 뒤에만 full 재무 캐시와 실행일 marker를 확정합니다.
8. full 체크포인트도 canary가 성공한 뒤에만 지워 실패 재실행이 SEC 수집을 이어받습니다.

마지막 full 이전의 점수와 재무 캐시는 각각 `scores.previous.json`,
`fundamentals.previous.json`에 한 세대 보관됩니다. 의미상 잘못된 데이터가 뒤늦게 발견되면
timer를 멈추고 두 파일을 같은 디렉터리의 임시 파일로 복사한 뒤 각각의 live 이름으로
원자 교체합니다. 점수만 되돌리고 재무 캐시를 남기면 다음 `prices`가 문제를 다시 게시합니다.

GitHub 수동 workflow를 비상용으로 실행할 때는 OCI timer를 먼저 멈추고 실행 화면의 단일 갱신기
확인란을 선택합니다. 호스트의 `flock`은 GitHub 러너나 다른 PC에서 동시에 쓰는 토스 자격증명까지
막아 주지 못합니다.
