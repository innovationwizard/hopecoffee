import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/services/auth";
import { hasPermission } from "@/lib/services/permissions";

const PUBLIC_ROUTES = ["/login"];
const MASTER_ONLY_ROUTES = ["/settings/users", "/import"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifyToken(token);
  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }

  if (
    MASTER_ONLY_ROUTES.some((r) => pathname.startsWith(r)) &&
    !hasPermission(session.roles, "user:manage")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-user-id", session.userId);
  response.headers.set("x-user-roles", session.roles.join(","));
  return response;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)"],
};
