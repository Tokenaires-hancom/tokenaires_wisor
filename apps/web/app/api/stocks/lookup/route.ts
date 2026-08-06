import { NextResponse } from "next/server";
import { lookupLiveStock, normalizeStockSymbol, TossInvestError } from "@/lib/tossInvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = normalizeStockSymbol(new URL(request.url).searchParams.get("symbol") ?? "");
  if (!symbol) {
    return NextResponse.json(
      { error: "종목코드는 005930 또는 AAPL처럼 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const stock = await lookupLiveStock(symbol);
    if (!stock) {
      return NextResponse.json({ error: "해당 종목의 현재 정보를 찾지 못했습니다." }, { status: 404 });
    }
    return NextResponse.json({ stock }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TossInvestError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "조회 요청이 몰렸습니다. 잠시 뒤 다시 시도해 주세요.", code: error.code },
          { status: 429 },
        );
      }
      if (error.status === 404) {
        return NextResponse.json({ error: "해당 종목의 현재 정보를 찾지 못했습니다." }, { status: 404 });
      }
      if (error.status === 400) {
        return NextResponse.json({ error: "종목코드 또는 티커 형식을 확인해 주세요." }, { status: 400 });
      }
      if (error.status === 401 || error.status === 403 || error.status === 503) {
        return NextResponse.json(
          { error: "실시간 종목 조회가 아직 설정되지 않았습니다.", code: "toss-unavailable" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "실시간 종목 정보를 불러오지 못했습니다." }, { status: 502 });
    }
    return NextResponse.json({ error: "실시간 종목 정보를 불러오지 못했습니다." }, { status: 502 });
  }
}
