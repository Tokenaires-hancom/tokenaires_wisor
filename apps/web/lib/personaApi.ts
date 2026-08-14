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
  const data: { error?: { code?: string; message?: string } } = await res
    .json()
    .catch(() => ({}));
  if (!res.ok) {
    throw new PersonaApiError(
      res.status,
      data.error?.code ?? "http_error",
      data.error?.message ?? `요청이 실패했습니다 (${res.status})`,
    );
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
