import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mpl_session";
const PUBLIC = ["/login", "/_next", "/favicon", "/api/health"];

/**
 * Edge gate: bounce requests without a session cookie to /login.
 * The session itself (expiry, idle timeout, active user, role) is validated
 * server-side on every page, action and API route.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
