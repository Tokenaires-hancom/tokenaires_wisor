# 개발 서버 세우기 (dev.wisor.site)

> 담당: 백엔드·플랫폼·배포·환경변수
> 자동 배포 계약은 [OCI 자동 배포](./oci-autodeploy.md)에 있습니다. 여기는 **빈 인스턴스를
> 그 계약이 돌 수 있는 상태로 만드는 절차**입니다.

`develop` push는 이 서버로, `main` push는 운영(`wisor.site`)으로 갑니다. 두 서버는 같은
배포기를 쓰고, 자기가 어느 쪽인지는 `/etc/wisor/deploy.conf`로만 압니다.

**이 문서는 운영 서버가 죽었을 때의 복구 절차이기도 합니다.** 운영은 손으로 세운 뒤
자동화를 붙였고 그 최초 절차가 어디에도 없었습니다. 개발 서버를 세우면서 남깁니다.

---

## 순서를 지켜야 하는 이유

배포기는 전환을 확정하기 전에 **공개 주소를 자기가 curl해서** 확인합니다
(`deploy/oci/bin/wisor-deploy`의 `verify_live`). 그래서 DNS와 인증서가 먼저 서야 첫 자동
배포가 자기 검증을 통과합니다. 자동 배포를 먼저 붙이면 서버는 멀쩡한데 배포만 실패합니다.

또 배포기는 **이미 살아 있는 서버를 전제로 합니다.** `/opt/wisor/current`,
`release.env`의 `WISOR_SHA`, 그 태그의 데이터 release, `batch-venv`가 없으면 시작조차
못 합니다. 그래서 첫 이미지는 손으로 올리고, 자동 배포는 마지막에 붙입니다.

```
OS·방화벽 → DNS → nginx :80 → 인증서 → /etc/wisor 설정 → 씨앗 데이터
  → 첫 이미지 수동 기동 → 확인 → 자동 배포 연결
```

**`deploy/oci/bin/wisor-deploy`가 브랜치를 설정에서 읽도록 바뀐 뒤의 코드로 부트스트랩해야
합니다.** 그 전 코드는 `origin/main`이 박혀 있어 첫 `develop` 배포가 조상 검사에서 죽습니다.

---

## 1. OS와 방화벽

docker·docker compose·git·python3-venv·nginx·certbot을 설치합니다.

**포트는 두 군데를 다 엽니다.** OCI 콘솔의 보안 목록(ingress 80·443)과 인스턴스 안의
방화벽입니다. Oracle 이미지는 콘솔 규칙과 별개로 iptables가 잠겨 있어서, 한쪽만 열면
certbot이 도메인 확인 단계에서 막힙니다.

## 2. DNS

`dev.wisor.site` A 레코드를 개발 인스턴스 공인 IP로 만듭니다. **예약(Reserved) IP를
붙입니다.** 임시 IP는 인스턴스 stop/start 때 바뀝니다 — 운영에서 그 일이 실제로 있었고,
DNS만 고치고 토스 허용 목록을 놓쳐 닷새 동안 배치가 죽었습니다.

개발 서버는 배치를 돌리지 않으므로 **토스 허용 목록에 이 IP를 넣지 않습니다.**

## 3. nginx와 인증서

`:80`으로 먼저 띄우고 certbot(HTTP-01)으로 인증서를 받은 뒤 `:443`을 엽니다.
`127.0.0.1:3000`(web)과 `127.0.0.1:8000`(persona)로 넘기는 구성은 운영과 같습니다.

개발 서버 nginx에는 **검색 노출을 막는 헤더**를 답니다.

```nginx
add_header X-Robots-Tag "noindex, nofollow" always;
```

앱을 고치지 않고 서버에서 막습니다. `apps/web`은 제품·UX·프론트엔드 담당 영역이라 이 목적으로 건드리지 않습니다.

## 4. `/etc/wisor` 설정

| 파일 | 개발 서버에 넣을 값 | 없거나 틀리면 |
|---|---|---|
| `deploy.conf` | `WISOR_DEPLOY_BRANCH=develop`<br>`WISOR_PUBLIC_ORIGIN=https://dev.wisor.site` | 배포기가 시작 단계에서 멈춥니다. 기본값으로 떨어지지 않습니다 |
| `web.env` | `SITE_ORIGIN=https://dev.wisor.site`, 개발 Supabase 값 3개 | `SITE_ORIGIN`이 다르면 계정 삭제가 전부 403입니다 |
| `persona.env` | `ALLOWED_ORIGINS=https://dev.wisor.site`, LLM 키 | `*`로 열리거나 해설이 고정 문구가 됩니다 |
| `web-build.env`·`persona-requirements.lock` | 운영과 같은 형식 | 배포기가 이미지 빌드 전에 죽습니다 |
| `batch.conf` | `WISOR_CODE_SHA`(현재 코드 SHA), `WISOR_FULL_HOUR_KST` | 배포기의 코드 SHA 3중 검사가 실패합니다 |
| `release.env` | `WISOR_SHA=<씨앗 태그>` | 데이터 release를 찾지 못합니다 |

`WISOR_PUBLIC_ORIGIN`은 **스킴을 포함하고 끝에 `/`를 붙이지 않습니다.** 배포기가
`${origin}/api/persona/health`로 이어 붙입니다.

**Supabase는 운영과 다른 프로젝트여야 합니다.** 키만 바꾸고 `NEXT_PUBLIC_SUPABASE_URL`이
운영으로 남으면 개발 서버가 실제 사용자 계정을 만지고, 계정 삭제 API는 service role 키를
쓰므로 **진짜로 지울 수 있습니다.** 새 프로젝트 준비는 [계정 설정](./auth-setup.md)을 봅니다.

### 배치는 돌리지 않지만 배치 파일은 필요합니다

`batch.conf`·`/opt/wisor/batch-source`·`/opt/wisor/batch-venv`는 **배치를 안 돌려도**
있어야 합니다. 배포기가 `current`·`batch-source`·`batch.conf`의 코드 SHA가 같은지 보고,
검증 스크립트를 `batch-venv`의 python으로 돌리기 때문입니다.

`wisor-batch.timer`는 **설치하지 않거나 비활성화합니다.** 토스 자격증명이 없고, 허용 IP도
운영 주소만 등록돼 있습니다.

## 5. 씨앗 데이터

운영의 현재 데이터 release에서 두 파일을 가져와 개발에 넣습니다.

```bash
# 운영에서 현재 태그 확인
sudo sed -n 's/^WISOR_SHA=//p' /etc/wisor/release.env
# → /var/lib/wisor-batch/releases/<태그>/{scores.json,fundamentals.json}
```

개발에서는 같은 이름의 디렉터리에 두 파일을 놓고 `release.env`의 `WISOR_SHA`를 그 태그로
씁니다. **태그 이름에 운영 코드 SHA가 박혀 있어도 됩니다** — 배포기는 이 값을 데이터
디렉터리를 찾는 데만 쓰고, 코드 SHA 검사와는 무관합니다.

저장소에 커밋된 `apps/web/lib/generated/scores.json`을 쓰지 않습니다. 그 사본은 2026-08-25
이후 갱신이 멈춰 있어서, 씨앗으로 쓰면 개발 화면이 조용히 낡은 기준일을 내보냅니다.

## 6. 첫 이미지 수동 기동

`deploy/oci/app`의 Dockerfile 둘로 이미지를 만들고 `compose.yaml`로 올립니다. 태그는
`release.env`의 `WISOR_SHA`와 같아야 합니다.

```bash
sudo docker compose --env-file /etc/wisor/release.env \
  -f /opt/wisor/deploy/compose.yaml up -d --wait
curl -fsS https://dev.wisor.site/ >/dev/null
curl -fsS https://dev.wisor.site/api/persona/health
curl -sI https://dev.wisor.site/ | grep -i x-robots-tag
```

## 7. 자동 배포 연결

**여기까지 통과한 뒤에** 붙입니다.

```bash
sudo bash deploy/oci/bootstrap-autodeploy.sh deploy/oci <개발 전용 공개키 파일>
```

GitHub 저장소의 `Development` Environment에 넣을 값은 [OCI 자동 배포](./oci-autodeploy.md)의
"두 환경" 절에 있습니다. **키는 운영과 다른 것을 새로 만듭니다.**

---

## 확인

`develop`에 커밋 하나를 올리고 워크플로가 끝난 뒤:

```bash
sudo git -C /opt/wisor/current rev-parse HEAD      # 그 커밋 SHA
sudo docker compose --env-file /etc/wisor/release.env \
  -f /opt/wisor/deploy/compose.yaml ps             # 둘 다 healthy
```

같은 시각에 운영이 그대로인지도 봅니다. 개발 배포가 운영을 건드리면 안 됩니다.

```bash
curl -fsS https://wisor.site/api/persona/health
sudo sed -n 's/^WISOR_SHA=//p' /etc/wisor/release.env   # 개발 배포 전후 동일
```

---

## 막혔을 때

**`develop`에 force-push나 reset이 있었다면 배포가 계속 거부됩니다.** 배포기는 요청 SHA가
현재 배포된 SHA의 자손일 때만 받습니다(과거로 되돌리는 자동 배포를 막기 위한 규칙입니다).
되돌린 이력 위에서는 새 커밋이 자손이 아니게 됩니다.

푸는 방법은 둘입니다.

- 현재 배포된 커밋을 포함하는 새 커밋을 `develop`에 올린다(merge)
- 개발 서버에서 `current`·`batch-source`·`batch.conf`의 코드 SHA를 새 기준으로 손으로 맞춘다

운영에서는 `main`이 되돌려지지 않으므로 이 상황이 잘 생기지 않습니다. 개발은 다릅니다.
