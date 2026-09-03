# OCI main 자동 배포

> 담당: 백엔드·플랫폼·배포·환경변수

GitHub `main`의 애플리케이션 변경은 검사에 통과한 커밋만 <https://wisor.site>에
자동 배포합니다. 브랜치 이름을 서버에서 다시 읽지 않고 push 이벤트가 가리킨 40자리 SHA를
끝까지 사용합니다.

```
main push
  → PR과 같은 Python·Web 검사
  → Production 환경의 제한 SSH 키
  → origin/main에 속한 SHA인지 서버에서 재검사
  → 현재 운영 데이터로 Web·Persona 이미지 생성
  → 두 컨테이너와 외부 경로 확인
  → 성공: 코드·배치 pin 함께 확정
  → 실패: 이전 이미지·코드·배치 pin 함께 복원
```

## 어떤 push가 배포되는가

`.github/workflows/deploy-oci.yml`은 `main` push만 받습니다. 아래 두 파일만 바뀐 커밋은
예외입니다.

- `apps/web/lib/generated/scores.json`
- `data-pipeline/data/fundamentals.json`

두 파일은 가격 배치가 만든 산출물이고 OCI의 `wisor-batch.timer`가 운영 데이터를 따로
갱신합니다. 코드·Dockerfile·Compose·배포 스크립트가 함께 바뀌면 위 파일이 포함돼도
정상적으로 앱 배포가 실행됩니다.

진행 중인 배포는 새 push 때문에 취소하지 않습니다. GitHub의 `oci-production` concurrency와
서버의 두 `flock`이 한 번에 하나만 실행되게 합니다. 서버 잠금 순서는 기존 배치와 같은
`wisor-batch.lock` → `wisor-deploy.lock`입니다.

## GitHub Production 환경

Repository의 `Production` Environment에 다음만 둡니다.

| 종류 | 이름 | 역할 |
|---|---|---|
| Secret | `OCI_DEPLOY_KEY` | 자동 배포 전용 ED25519 개인키 |
| Secret | `OCI_KNOWN_HOSTS` | 콘솔에서 확인한 운영 서버 host key |
| Variable | `OCI_HOST` | 운영 DNS 이름 |
| Variable | `OCI_PORT` | SSH 포트 |
| Variable | `OCI_USER` | 강제 명령 전용 계정 |

OpenRouter·Supabase·데이터 공급자 비밀값은 GitHub Actions가 운반하지 않습니다. 기존처럼
서버의 `/etc/wisor/*.env`에만 있습니다. Production의 배포 브랜치 정책도 `main` 하나로
제한합니다.

이 구조에서 `main` 쓰기 권한은 곧 운영 배포 권한입니다. 현재 예약 데이터 작업이 `main`에
직접 산출물을 push하므로 PR 승인이나 Environment reviewer는 강제하지 않습니다. 저장소의 push
권한을 넓히거나 외부 기여를 받을 때는 데이터 push를 별도 GitHub App/PR 흐름으로 옮긴 뒤
`main` 보호와 필수 승인을 함께 켜야 합니다.

## SSH 권한 경계

Actions 키는 `ubuntu` 계정이나 일반 셸에 들어갈 수 없습니다.
`deploy/oci/bootstrap-autodeploy.sh`가 별도 `wisor-deploy` 계정을 만들고 공개키에
`restrict`와 강제 명령을 붙입니다. 허용되는 입력은 다음 한 형태뿐입니다.

```text
deploy <소문자 40자리 commit SHA>
```

dispatcher가 형식을 확인한 뒤 SHA 한 줄만 root 배포기의 표준 입력으로 넘깁니다. 포트·에이전트·
X11 forwarding과 PTY는 허용하지 않습니다. 서버 배포기는 해당 SHA가 현재 공식
`origin/main`에 속하는지 다시 확인하고, 현재 운영 커밋보다 과거인 SHA는 거부합니다. 요청 뒤에
더 최신 커밋이 있으면 배치 산출물 두 파일만 바뀐 경우에만 허용합니다. 따라서 예약 데이터 push가
끼어들어도 앱 배포는 유실되지 않고, 더 최신 앱 코드가 있으면 오래된 요청은 거부됩니다.

## 서버 전환 계약

운영 경로는 다음과 같습니다.

- 코드 release: `/opt/wisor/releases/<full-sha>`
- 현재 코드: `/opt/wisor/current`
- Compose·Dockerfile: `/opt/wisor/deploy/`
- 배치 소스: `/opt/wisor/batch-source`
- 배치 코드 pin: `/etc/wisor/batch.conf`의 `WISOR_CODE_SHA`
- 활성 이미지·데이터 tag: `/etc/wisor/release.env`의 `WISOR_SHA`
- 이전 상태: `/opt/wisor/deploy-state/`

코드 SHA와 활성 이미지 tag는 같은 값이 아닙니다. 이미지 tag에는 현재 운영 데이터 hash도
들어갑니다. 코드 배포는 현재 정상 데이터 묶음을 새 코드 이미지에 넣고, 같은 tag의
`scores.json`·`fundamentals.json` rollback 자료를 먼저 만든 뒤 전환합니다.

성공 판정은 다음을 모두 확인합니다.

1. Web·Persona 이미지의 revision label이 요청 SHA와 같습니다.
2. 두 이미지의 데이터 hash label이 현재 정상 데이터와 같습니다.
3. Compose의 두 컨테이너가 healthy입니다.
4. Persona `/meta`의 생성 시각·데이터 출처·기업 수가 후보 JSON과 같습니다.
5. Web 스크리너와 Nginx, `https://wisor.site/api/persona/health`가 응답합니다.

전환 중 하나라도 실패하면 이전 `release.env`, Compose 정의, `/opt/wisor/current`,
`batch-source`, `WISOR_CODE_SHA`를 복원하고 이전 서비스까지 다시 검증합니다. 자동 롤백 검증도
실패하면 후보를 지우지 않고 해당 `/opt/wisor/deploy-state/<시각>-<sha>/`를 보존합니다.
복구 여부는 전환 단계 플래그가 아니라 `deploy-state`에 실제로 남은 `*.previous`와 현재 경로를
기준으로 판단합니다. 따라서 디렉터리 rename 직후 신호가 들어와도 이전 트리를 찾을 수 있습니다.

## 활성화와 확인

워크플로 파일이 `main`에 들어가는 push부터 자동 배포가 시작됩니다. 따라서 처음 활성화할
때는 아래 순서를 지킵니다.

1. OCI에 전용 계정·dispatcher·배포기를 먼저 설치합니다.
2. GitHub Production secrets·variables와 `main` branch policy를 등록합니다.
3. 그 뒤 워크플로와 배포 파일을 `main`에 병합합니다.

배포 상태는 GitHub Actions의 `OCI 운영 배포`에서 확인합니다. 서버에서는 다음이 같은 코드
SHA를 가리켜야 합니다.

```bash
sudo git -C /opt/wisor/current rev-parse HEAD
sudo git -C /opt/wisor/batch-source rev-parse HEAD
sudo sed -n 's/^WISOR_CODE_SHA=//p' /etc/wisor/batch.conf
sudo docker compose --env-file /etc/wisor/release.env \
  -f /opt/wisor/deploy/compose.yaml ps
```

운영 장애에서 자동 롤백까지 실패했다면 추가 배포를 반복하지 말고 가장 최근
`/opt/wisor/deploy-state/`를 보존한 채 원인을 확인합니다.

## 현재 운영 제약

- catchable signal과 정상 오류는 자동 롤백하지만 SIGKILL·VM 재부팅 중간상태는 자동 복구하지
  않습니다. 이 경우 `deploy-state`와 네 pin을 대조한 뒤 수동 복구합니다.
- 과거 code release·deploy-state의 보존 기한은 아직 없습니다. Docker build cache는 매번
  제한하지만 디스크 사용량과 이전 release는 별도로 점검해야 합니다.
- `wisor.service`, batch wrapper/venv, Persona requirements lock은 서버 운영 기반입니다. tracked
  unit은 현재 계약을 기록하지만 앱 push가 자동 교체하지 않습니다.
