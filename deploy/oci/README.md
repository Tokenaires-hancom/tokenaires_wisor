# OCI 운영 파일

이 디렉터리는 **서버 상태의 기록**입니다. 여기를 고쳐도 서버는 바뀌지 않습니다.
서버를 고치면 여기도 같이 고쳐야 기록이 사실로 남습니다.

## 무엇이 어디에 있고, 무엇이 설치하나

| 저장소 | 서버 | 설치 주체 |
|---|---|---|
| `bin/wisor-deploy` | `/usr/local/sbin/wisor-deploy` | `bootstrap-autodeploy.sh` |
| `bin/wisor-deploy-dispatch` | `/usr/local/sbin/wisor-deploy-dispatch` | `bootstrap-autodeploy.sh` |
| `bin/verify-live.py` | `/usr/local/libexec/wisor-verify-live.py` | `bootstrap-autodeploy.sh` |
| `lib/deploy-state.sh` | `/usr/local/libexec/wisor-deploy-state.sh` | `bootstrap-autodeploy.sh` |
| `app/compose.yaml` | `/opt/wisor/deploy/compose.yaml` | `wisor-deploy` |
| `app/Dockerfile.web` · `app/Dockerfile.persona` | `/opt/wisor/deploy/` | `wisor-deploy` |
| `bin/wisor-batch` | `/usr/local/libexec/wisor-batch` | **없음** |
| `bin/validate-scores.py` | `/usr/local/libexec/wisor-validate-scores.py` | **없음** |
| `systemd/wisor.service` | `/etc/systemd/system/wisor.service` | **없음** |
| `systemd/wisor-batch.service` | `/etc/systemd/system/wisor-batch.service` | **없음** |
| `systemd/wisor-batch.timer` | `/etc/systemd/system/wisor-batch.timer` | **없음** |

**"없음"인 다섯은 저장소에 설치 경로가 아예 없습니다.** 서버에서 바뀐 내용을 여기 옮겨 적는
일도, 그 반대도 사람이 손으로 합니다. 그래서 이 파일들은 가만히 두면 조용히 낡습니다.

## 대조하는 법

```bash
systemctl cat wisor-batch.timer --no-pager
systemctl cat wisor-batch.service --no-pager
sudo cat /usr/local/libexec/wisor-batch
sudo cat /usr/local/libexec/wisor-validate-scores.py
```

저장소 파일과 다르면 **서버가 사실이고 저장소가 낡은 것**입니다. 저장소를 서버에 맞춰 고칩니다.

**반대로 하지 마세요.** 저장소 파일을 서버에 설치하는 절차는 여기 두지 않습니다. 지금 돌아가는
배치를 깨뜨릴 수 있고, 실제로 예전 README가 그런 안내를 담고 있었습니다.

## 배치가 하는 일

매 실행마다 Web·Persona 이미지를 새로 빌드하고, 데이터 검증을 통과한 뒤에만 `release.env`를
바꿉니다. 애플리케이션 배포와 같은 두 잠금을 같은 순서로 씁니다
(`wisor-batch.lock` → `wisor-deploy.lock`).

자세한 것은 다음을 봅니다.

- 애플리케이션 자동 배포: `docs/oci-autodeploy.md`
- 데이터 갱신 경로와 막혔을 때의 대처: `docs/deploy.md`
