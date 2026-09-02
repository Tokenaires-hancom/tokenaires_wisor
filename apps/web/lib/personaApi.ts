/** persona_explain HTTP API. 브라우저는 /api/persona 만 본다.
 *  Next rewrite가 파이썬 서버로 넘긴다. 숫자는 보내지 않고 선택한 ticker와 persona만 보낸다. */

const BASE = "/api/persona";

export type PersonaInfo = {
  id: string;
  name: string;
  /** score면 점수를 내는 대가, checklist면 확인 질문만 주는 대가. */
  evaluation?: "score" | "checklist";
  /** 채점 모델이 없는 대가에는 없다. */
  modelVersion?: string;
};

export type CompanyHit = {
  ticker: string;
  name: string;
  sector: string;
  styles: string[];
};

export type ChatMessage = {
  sessionId: string;
  persona: string;
  personaName: string;
  text: string;
  verdict: string;
  regenerated: boolean;
  blocked: boolean;
};

export class PersonaApiError extends Error {
  /** 필드를 따로 선언하고 생성자에서 넣는다. `constructor(public status: ...)`로 줄이면
   *  npm test가 쓰는 `node --test`가 이 파일을 못 읽는다 — 타입을 지우기만 할 뿐
   *  파라미터 프로퍼티가 만들어내는 대입문을 생성하지 못한다. */
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PersonaApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let parseFailed = false;
  const data: { error?: { code?: string; message?: string } } = await res
    .json()
    .catch(() => {
      parseFailed = true;
      return {};
    });
  if (!res.ok) {
    throw new PersonaApiError(
      res.status,
      data.error?.code ?? "http_error",
      data.error?.message ?? `요청이 실패했습니다 (${res.status})`,
    );
  }
  if (parseFailed) {
    // 여기서 res.status는 2xx(성공). 바디만 못 읽은 클라이언트측 실패이므로
    // 성공 코드를 그대로 실으면 오해를 부른다. HTTP 상태 없음을 뜻하는 0으로 둔다.
    throw new PersonaApiError(0, "invalid_json", "응답을 해석할 수 없습니다");
  }
  return data as T;
}

export function getHealth() {
  return request<{
    status: string;
    adapter: string;
    model: string | null;
    personas: PersonaInfo[];
  }>("GET", "/health");
}

export function searchCompanies(q: string, limit = 8) {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return request<{ query: string; results: CompanyHit[] }>(
    "GET",
    `/companies?${query}`,
  );
}

export async function createSession(
  ticker: string | null,
  persona: string,
): Promise<ChatMessage> {
  const data = await request<{
    sessionId: string;
    persona: string;
    personaName: string;
    opening: string;
    verdict: string;
    regenerated: boolean;
    blocked: boolean;
  }>(
    "POST",
    "/sessions",
    ticker === null ? { persona } : { ticker, persona },
  );
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.opening,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
  };
}

export async function askQuestion(sessionId: string, question: string): Promise<ChatMessage> {
  const data = await request<{
    sessionId: string;
    persona: string;
    personaName: string;
    reply: string;
    verdict: string;
    regenerated: boolean;
    blocked: boolean;
  }>("POST", `/sessions/${sessionId}/messages`, { question });
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.reply,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
  };
}

export async function switchPersona(sessionId: string, persona: string): Promise<ChatMessage> {
  const data = await request<{
    sessionId: string;
    persona: string;
    personaName: string;
    opening: string;
    verdict: string;
    regenerated: boolean;
    blocked: boolean;
  }>("POST", `/sessions/${sessionId}/persona`, { persona });
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.opening,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
  };
}

export function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return request("DELETE", `/sessions/${sessionId}`);
}

export function isGone(err: unknown): boolean {
  return err instanceof PersonaApiError && err.code === "session_not_found";
}

/**
 * 요청이 서버에 반영됐는지 클라이언트가 확정할 수 없는 실패다.
 * 이 경우 같은 세션을 계속 쓰면 화면에 없는 답변을 서버만 기억할 수 있다.
 */
export function isAmbiguousSessionFailure(err: unknown): boolean {
  if (!(err instanceof PersonaApiError)) return true;
  if (err.code === "model_error") return false;
  return err.status === 0 || err.status >= 500;
}
