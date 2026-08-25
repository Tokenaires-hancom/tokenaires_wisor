/** match-3 보드 순수 로직 — DOM·랜덤을 모른다.
 *
 *  보드는 number[][]. 값은 타일 종류(0~), -1은 빈 칸. 좌표는 "r,c" 문자열로 다룬다. */

export type Board = number[][];
export type Cell = { r: number; c: number };

/** 같은 종류가 가로·세로로 3개 이상 연속인 칸을 모두 반환한다.
 *  가로 런과 세로 런을 따로 훑어 합친다(L·T자는 자연히 합집합). 빈 칸(-1)은 제외. */
export function findMatches(board: Board): Set<string> {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const matched = new Set<string>();

  const scan = (get: (i: number) => number, key: (i: number) => string, len: number) => {
    let run = 1;
    for (let i = 1; i <= len; i += 1) {
      const same = i < len && get(i) === get(i - 1) && get(i) >= 0;
      if (same) {
        run += 1;
      } else {
        if (run >= 3) for (let k = i - run; k < i; k += 1) matched.add(key(k));
        run = 1;
      }
    }
  };

  for (let r = 0; r < rows; r += 1) {
    scan((c) => board[r][c], (c) => `${r},${c}`, cols);
  }
  for (let c = 0; c < cols; c += 1) {
    scan((r) => board[r][c], (r) => `${r},${c}`, rows);
  }
  return matched;
}

const clone = (board: Board): Board => board.map((row) => row.slice());

/** 시작 매치가 없는 보드를 만든다. rand()는 0~typeCount 미만의 타일 종류를 준다.
 *  매치가 있으면 해당 칸만 다시 뽑아 없앤다. */
export function makeBoard(rows: number, cols: number, typeCount: number, rand: () => number): Board {
  const board: Board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => rand() % typeCount),
  );
  let matched = findMatches(board);
  while (matched.size > 0) {
    for (const key of matched) {
      const [r, c] = key.split(",").map(Number);
      board[r][c] = rand() % typeCount;
    }
    matched = findMatches(board);
  }
  return board;
}

/** 두 칸을 바꿔보고 매치가 생기는지. 원본은 건드리지 않는다. */
export function isValidSwap(board: Board, a: Cell, b: Cell): boolean {
  const next = clone(board);
  [next[a.r][a.c], next[b.r][b.c]] = [next[b.r][b.c], next[a.r][a.c]];
  return findMatches(next).size > 0;
}

/** 매치된 칸을 비우고, 각 열의 남은 타일을 아래로 내린 뒤, 위 빈칸을 fill()로 채운다.
 *  새 보드를 반환한다(원본 불변). fill은 테스트 위해 주입받는다. */
export function collapse(board: Board, matched: Set<string>, fill: () => number): Board {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const next = clone(board);
  for (const key of matched) {
    const [r, c] = key.split(",").map(Number);
    next[r][c] = -1;
  }
  for (let c = 0; c < cols; c += 1) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r -= 1) {
      if (next[r][c] >= 0) {
        next[write][c] = next[r][c];
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r -= 1) next[r][c] = fill();
  }
  return next;
}
