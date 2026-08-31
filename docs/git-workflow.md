# 깃·깃허브 사용 규칙

> **브랜치 이름과 커밋 메시지 형식은 여기 없습니다.** 루트 `CLAUDE.md`의 "브랜치와 커밋" 절
> 하나가 그것을 정합니다. 두 곳에 적으면 한쪽만 고쳐져서 서로 다른 말을 하게 됩니다.
>
> 이 문서는 **손이 어떻게 움직여야 하는가**만 다룹니다. 4명 다 비개발자라, 깃이 잘못
> 안내하는 자리와 실제로 사고가 났던 자리를 적어 둡니다.

---

## 1. 리모트는 `origin` 하나입니다

```bash
git remote -v
# origin  https://github.com/Tokenaires-hancom/tokenaires_wisor.git (fetch)
# origin  https://github.com/Tokenaires-hancom/tokenaires_wisor.git (push)
```

**두 줄이 아니라 네 줄이 나오면 고쳐야 합니다.** 개인 포크가 `origin`으로 잡혀 있으면,
새 브랜치에서 `git push`를 쳤을 때 깃이 이렇게 안내합니다.

```
git push --set-upstream origin feat/my-branch
```

깃이 시키는 대로 따르면 **작업이 포크로 들어가고 팀 저장소에는 보이지 않습니다.**
"분명히 push했는데 깃허브에 없다"의 대부분이 이것입니다.

포크가 잡혀 있으면 이렇게 뗍니다. 로컬 설정만 바뀌고 깃허브의 포크는 그대로 남습니다.

```bash
git remote remove origin              # 포크를 뗀다
git remote rename upstream origin     # 팀 저장소를 origin으로
git fetch origin --prune
```

---

## 2. 새 작업은 **방금 받아온** `develop`에서 시작합니다

```bash
git fetch origin --prune
git switch -c feat/새작업 origin/develop
```

두 번째 줄의 `origin/develop`이 핵심입니다. **`git switch -c 이름`만 치면 지금 서 있는
자리에서 갈라집니다.** 그 자리가 두 달 전 커밋이면 브랜치는 태어날 때부터 두 달 뒤처집니다.

딸 때는 아무 문제가 없고, 병합할 때 충돌로 돌아옵니다. 2026-08-31 기준으로 로컬 `main`은
49커밋, `develop`은 61커밋 뒤에 있었고 기능 브랜치 넷이 53커밋 넘게 뒤처져 충돌이 났습니다.

---

## 3. 자리를 뜨기 전에 커밋하거나 `stash` 합니다

```bash
git stash push -m "무엇을 하다 말았는지"   # 잠깐 치워 둘 때
git stash list                            # 치워 둔 것 확인
git stash pop                             # 되돌리기
```

커밋되지 않은 파일은 **이 PC의 디스크에만 있습니다.** 브랜치를 옮기지도 못하고, 시간이
지나면 무엇을 하다 말았는지도 알 수 없게 됩니다.

완성되지 않아도 커밋해도 됩니다. 커밋은 나중에 다시 나눌 수 있고, 잃어버린 파일은
되돌릴 수 없습니다. 병합할 생각이 없는 진행분이면 커밋 본문에 그렇게 적어 둡니다.

---

## 4. 다시 만들기 전에 이미 들어갔는지 봅니다

```bash
git cherry origin/develop 브랜치이름
```

- `+` … 아직 `develop`에 없습니다
- `-` … **내용은 이미 `develop`에 있습니다** (병합될 때 SHA가 바뀌어서 커밋만 남은 것)

`git log`만 보면 `-`도 "안 올라간 커밋"처럼 보입니다. 실제로 이미 병합된 작업을 다시
만든 적이 있습니다.

---

## 5. 두 점과 세 점은 다른 것을 보여줍니다

"내 브랜치가 무엇을 바꿨나"를 볼 때 자주 틀리는 자리입니다.

| 명령 | 보여주는 것 |
|---|---|
| `git diff origin/develop..HEAD` | develop과 지금의 **차이 전부** — develop이 앞서간 것까지 "내가 지운 것"처럼 나옵니다 |
| `git diff origin/develop...HEAD` | **내 브랜치가 갈라진 뒤 더한 것만** |

같은 브랜치를 두 점으로 보면 487개 파일, 세 점으로 보면 78개 파일이 나온 적이 있습니다.
**리뷰할 때는 세 점입니다.**

---

## 6. 브랜치는 `develop`으로만 갑니다

```
기능 브랜치  →  develop  →  main  →  운영 배포
```

기능 브랜치에서 `main`으로 바로 PR을 열면 `.github/workflows/check.yml`의 첫 스텝이
막습니다. `main`과 `develop`이 양방향으로 갈라지면 그것을 되돌리는 브랜치가 또 생깁니다.

`main`에 커밋이 들어가면 **그 즉시 운영 서버 배포가 돕니다**(`.github/workflows/deploy-oci.yml`).
`main` 병합은 "합치기"가 아니라 "배포하기"입니다.

### 브랜치 보호 상태 (2026-08-31 확인)

| 브랜치 | 보호 | 뜻 |
|---|---|---|
| `develop` | `check` 통과 필수 · 최신 상태 필수 · 승인 1명 · 코드오너 리뷰 | 조건을 못 채우면 병합 버튼이 잠깁니다 |
| `main` | **없음** | 검사가 빨간 X여도 병합됩니다 |

지키는 쪽과 지켜야 할 쪽이 뒤바뀌어 있습니다. 배포가 나가는 `main`이 아무 조건 없이
열려 있어서, 차단 사유가 적힌 PR이 그대로 병합돼 배포가 실패한 적이 있습니다(PR #80).

`main`에도 `develop`과 같은 규칙을 걸어 두는 것을 권합니다 — Settings → Branches → `main`.

---

## 자주 쓰는 확인 명령

| 알고 싶은 것 | 명령 |
|---|---|
| 지금 어디에 서 있나 | `git status` |
| 깃허브와 몇 커밋 차이인가 | `git fetch origin --prune` 후 `git status` |
| 내 브랜치가 무엇을 바꿨나 | `git diff --stat origin/develop...HEAD` |
| 이 작업이 이미 들어갔나 | `git cherry origin/develop 브랜치이름` |
| 깃허브에 있는 브랜치 목록 | `git branch -r` |
| 원격이 사라진 로컬 브랜치 | `git branch -vv \| grep ": gone]"` |

원격이 사라진 브랜치를 지울 때는 **`git branch -d`**(소문자)를 씁니다. 병합되지 않은
것이 남아 있으면 깃이 거부합니다. `-D`는 확인 없이 지우므로 쓰지 않습니다.
