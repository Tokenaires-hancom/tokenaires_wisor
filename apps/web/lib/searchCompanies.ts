import { COMPANY_NAME_EN } from "../content/companyNamesEn.ts";
import type { Company } from "./scores.types";

/** 영어 이름은 단어 시작에서만 맞는다고 본다("out"이 "South" 중간에 우연히
 *  껴 있다고 사우스웨스트 항공·서던 컴퍼니가 걸리면 안 된다). 티커·한글
 *  이름은 부분일치를 그대로 둔다 — 둘 다 짧고 밀도가 높아 중간에 우연히
 *  겹치는 일이 영어 단어만큼 흔하지 않다. */
function matchesWordStart(text: string, q: string): boolean {
  const lower = text.toLowerCase();
  if (lower.startsWith(q)) return true;
  return lower.split(/[^a-z0-9]+/).some((word) => word.startsWith(q));
}

/** 회사 이름(한글)·영어 회사명·티커로 찾는다. 대소문자는 구분하지 않는다.
 *  `scores.json`의 `name`은 한글 표기만 있어서(토스증권 API가 그렇게 준다)
 *  영어로 쳐도 찾히려면 별도 영어명 목록(COMPANY_NAME_EN)을 함께 봐야 한다.
 *  빈 검색어(공백만 있어도)는 필터링하지 않고 원래 목록을 그대로 돌려준다 —
 *  종목 찾기 목록이 검색창 때문에 갑자기 비어 보이면 안 된다. */
export function filterCompaniesByQuery(companies: Company[], query: string): Company[] {
  const q = query.trim().toLowerCase();
  if (!q) return companies;
  return companies.filter((c) => {
    const nameEn = COMPANY_NAME_EN[c.ticker];
    return (
      c.name.toLowerCase().includes(q) ||
      c.ticker.toLowerCase().includes(q) ||
      (nameEn !== undefined && matchesWordStart(nameEn, q))
    );
  });
}
