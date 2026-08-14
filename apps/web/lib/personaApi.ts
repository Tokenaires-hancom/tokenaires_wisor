/** persona_explain HTTP API. 브라우저는 /api/persona 만 본다.
 *  Next rewrite가 파이썬 서버로 넘긴다. 숫자는 보내지 않고 ticker·persona만 보낸다. */

const BASE = "/api/persona";

export type PersonaInfo = {
  id: string;
  name: string;
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
  disclaimer: string;
};

export class PersonaApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PersonaApiError";
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

export async function createSession(ticker: string, persona: string): Promise<ChatMessage> {
  const data = await request<{
    sessionId: string;
    persona: string;
    personaName: string;
    opening: string;
    verdict: string;
    regenerated: boolean;
    blocked: boolean;
    disclaimer: string;
  }>("POST", "/sessions", { ticker, persona });
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.opening,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
    disclaimer: data.disclaimer,
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
    disclaimer: string;
  }>("POST", `/sessions/${sessionId}/messages`, { question });
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.reply,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
    disclaimer: data.disclaimer,
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
    disclaimer: string;
  }>("POST", `/sessions/${sessionId}/persona`, { persona });
  return {
    sessionId: data.sessionId,
    persona: data.persona,
    personaName: data.personaName,
    text: data.opening,
    verdict: data.verdict,
    regenerated: data.regenerated,
    blocked: data.blocked,
    disclaimer: data.disclaimer,
  };
}

export function isGone(err: unknown): boolean {
  return err instanceof PersonaApiError && err.code === "session_not_found";
}
