const TOSS_API_BASE = "https://openapi.tossinvest.com";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

type TossEnvelope<T> = {
  result: T;
};

type TossErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

type TossStock = {
  symbol: string;
  name: string;
  englishName: string | null;
  market: string;
  securityType: string;
  status: string;
  currency: string;
  listDate: string | null;
  sharesOutstanding: string | null;
};

type TossPrice = {
  symbol: string;
  timestamp: string;
  lastPrice: string;
  currency: string;
};

export type LiveStock = {
  symbol: string;
  name: string;
  englishName: string | null;
  market: string;
  securityType: string;
  status: string;
  currency: string;
  listDate: string | null;
  sharesOutstanding: string | null;
  lastPrice: string;
  priceTimestamp: string;
  source: "toss-invest";
};

export class TossInvestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = "TossInvestError";
    this.status = status;
    this.code = code;
  }
}

let tokenCache: TokenCache | null = null;

export function normalizeStockSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  if (!symbol || symbol.length > 20 || !/^[A-Z0-9.-]+$/.test(symbol)) return null;
  return symbol;
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.TOSS_INVEST_CLIENT_ID;
  const clientSecret = process.env.TOSS_INVEST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new TossInvestError(
      "토스증권 Open API 환경변수가 설정되지 않았습니다.",
      503,
      "toss-not-configured",
    );
  }

  return { clientId, clientSecret };
}

async function readError(response: Response): Promise<TossInvestError> {
  let payload: TossErrorEnvelope | null = null;
  try {
    payload = (await response.json()) as TossErrorEnvelope;
  } catch {
    // 토스가 JSON이 아닌 오류를 반환해도 비밀값이나 원문 응답은 노출하지 않는다.
  }

  return new TossInvestError(
    payload?.error?.message ?? "토스증권 데이터 조회에 실패했습니다.",
    response.status,
    payload?.error?.code,
  );
}

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = credentials();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(`${TOSS_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) throw await readError(response);

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token || !payload.expires_in) {
    throw new TossInvestError("토스증권 인증 응답 형식이 올바르지 않습니다.", 502);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1_000,
  };
  return payload.access_token;
}

async function tossGet<T>(path: string, retryAuth = true): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${TOSS_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 401 && retryAuth) {
    tokenCache = null;
    return tossGet<T>(path, false);
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as T;
}

export async function lookupLiveStock(symbolInput: string): Promise<LiveStock | null> {
  const symbol = normalizeStockSymbol(symbolInput);
  if (!symbol) {
    throw new TossInvestError("종목코드 또는 티커 형식을 확인해 주세요.", 400, "invalid-symbol");
  }

  const encoded = encodeURIComponent(symbol);
  const [stockResponse, priceResponse] = await Promise.all([
    tossGet<TossEnvelope<TossStock[]>>(`/api/v1/stocks?symbols=${encoded}`),
    tossGet<TossEnvelope<TossPrice[]>>(`/api/v1/prices?symbols=${encoded}`),
  ]);
  const stock = stockResponse.result.find((item) => item.symbol.toUpperCase() === symbol);
  const price = priceResponse.result.find((item) => item.symbol.toUpperCase() === symbol);
  if (!stock || !price) return null;

  return {
    symbol: stock.symbol,
    name: stock.name,
    englishName: stock.englishName,
    market: stock.market,
    securityType: stock.securityType,
    status: stock.status,
    currency: price.currency || stock.currency,
    listDate: stock.listDate,
    sharesOutstanding: stock.sharesOutstanding,
    lastPrice: price.lastPrice,
    priceTimestamp: price.timestamp,
    source: "toss-invest",
  };
}
