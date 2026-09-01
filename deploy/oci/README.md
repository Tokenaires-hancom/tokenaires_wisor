# OCI 운영 파일

파일마다 **어느 쪽이 원본인지가 다릅니다.** 그것부터 보고 고치세요.

## 저장소가 원본 — 배포가 서버에 설치합니다

| 저장소 | 서버 | 설치 시점 |
|---|---|---|
| `bin/wisor-deploy` | `/usr/local/sbin/wisor-deploy` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `bin/wisor-deploy-dispatch` | `/usr/local/sbin/wisor-deploy-dispatch` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `bin/verify-live.py` | `/usr/local/libexec/wisor-verify-live.py` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `lib/deploy-state.sh` | `/usr/local/libexec/wisor-deploy-state.sh` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `bin/wisor-batch` | `/usr/local/libexec/wisor-batch` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `bin/validate-scores.py` | `/usr/local/libexec/wisor-validate-scores.py` | 배포 성공 뒤 · `bootstrap-autodeploy.sh` |
| `app/compose.yaml` · `app/Dockerfile.*` | `/opt/wisor/deploy/` | 배포 전환 때 |

여기는 저장소를 고치면 다음 `main` 배포가 서버에 반영합니다. 서버에서 직접 고치면 **다음 배포에
덮여 사라집니다.** 배포는 이 파일들이 없거나 구문 검사를 통과하지 못하면 설치 전에 멈추고,
설치는 배포가 건강하다고 확인된 뒤에만 일어납니다. 배치 wrapper를 바꿀 때는 배포가 배치 잠금을
쥔 채로 덮으므로 실행 중인 배치와 겹치지 않습니다.

## 서버가 원본 — 설치 경로가 없습니다

| 저장소 | 서버 |
|---|---|
| `systemd/wisor.service` | `/etc/systemd/system/wisor.service` |
| `systemd/wisor-batch.service` | `/etc/systemd/system/wisor-batch.service` |
| `systemd/wisor-batch.timer` | `/etc/systemd/system/wisor-batch.timer` |

unit은 자동으로 설치하지 않습니다. `daemon-reload`가 필요하고 돌아가는 timer를 배포 도중에
바꾸게 되기 때문입니다. 그래서 이 셋은 **사람이 손으로 옮겨 적어야 하고, 두면 조용히 낡습니다.**

서버에서 unit을 바꿨다면 여기도 함께 고칩니다. 다르면 서버가 사실입니다.

```bash
systemctl cat wisor.service --no-pager
systemctl cat wisor-batch.service --no-pager
systemctl cat wisor-batch.timer --no-pager
```

**저장소의 unit을 서버에 설치하지 마세요.** 여기가 낡아 있으면 돌아가는 배치가 멈춥니다.
실제로 2026-08-26에 이 셋이 낡아 있었고, 그때 예전 README는 그걸 설치하라고 적고 있었습니다.

## 배치가 하는 일

매 실행마다 Web·Persona 이미지를 새로 빌드하고, `bin/validate-scores.py`를 통과한 뒤에만
`release.env`를 바꿉니다. 애플리케이션 배포와 같은 두 잠금을 같은 순서로 씁니다
(`wisor-batch.lock` → `wisor-deploy.lock`).

- 애플리케이션 자동 배포: `docs/oci-autodeploy.md`
- 데이터 갱신 경로와 막혔을 때의 대처: `docs/deploy.md`
