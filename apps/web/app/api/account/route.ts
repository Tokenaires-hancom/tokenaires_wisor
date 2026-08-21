import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasValidDeleteConfirmation, isSameOrigin } from "@/lib/accountDeletion";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) {
    return NextResponse.json({ message: "허용되지 않은 계정 삭제 요청입니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "삭제 확인 문구를 다시 입력해 주세요." }, { status: 400 });
  }

  const confirmation =
    typeof body === "object" && body !== null && "confirmation" in body
      ? (body as { confirmation?: unknown }).confirmation
      : undefined;
  if (!hasValidDeleteConfirmation(confirmation)) {
    return NextResponse.json({ message: "삭제 확인 문구가 일치하지 않습니다." }, { status: 400 });
  }

  const sessionClient = await createSessionClient();
  if (!sessionClient) {
    return NextResponse.json({ message: "계정 연결 설정을 확인해 주세요." }, { status: 503 });
  }
  const { data, error: userError } = await sessionClient.auth.getUser();
  if (userError || !data.user) {
    return NextResponse.json({ message: "로그인 상태를 다시 확인해 주세요." }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json({ message: "계정 삭제를 위한 운영 설정이 필요합니다." }, { status: 503 });
  }

  const adminClient = createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error("Supabase account deletion failed", deleteError.code);
    return NextResponse.json(
      { message: "계정을 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  return NextResponse.json({ deleted: true });
}
