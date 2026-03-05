import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = [
  "/prospects",
  "/companies",
  "/content",
  "/findings",
  "/settings",
  "/capture",
  "/my-company",
  "/fit-overview",
  "/review",
  "/suggestions",
  "/api",
];

const AUTH_PATHS = ["/auth", "/api/auth"];

const PUBLIC_API_PATHS = ["/api/bookmarklet-install"];

function isProtected(pathname: string, searchParams?: URLSearchParams): boolean {
  if (pathname === "/capture" && searchParams?.has("token")) return false;
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return false;
  return PROTECTED_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase not configured" },
      { status: 503 }
    );
  }

  const { pathname, searchParams } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    await supabase.auth.getUser();

    if (isAuthPath(pathname)) {
      return supabaseResponse;
    }

    if (isProtected(pathname, searchParams)) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";
        url.searchParams.set("redirect", pathname);
        return Response.redirect(url);
      }
    }

    return supabaseResponse;
  } catch (err) {
    console.error("Middleware error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
