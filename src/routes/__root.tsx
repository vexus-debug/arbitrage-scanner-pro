import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ScannerProvider, useScanner } from "../lib/scanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Triangular Arbitrage Scanner — Bybit Spot" },
      {
        name: "description",
        content:
          "Read-only research console scanning Bybit public spot markets for executable 3-asset triangular arbitrage cycles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/logbook", label: "Logbook" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
] as const;

function Chrome() {
  const { online, scanning, settings, proxied, lastError } = useScanner();

  return (
    <div className="min-h-screen">
      {settings.mockMode && (
        <div className="sticky top-0 z-50 bg-warn px-4 py-1.5 text-center text-xs font-bold tracking-[0.2em] text-background uppercase">
          ⚠ Mock data — not live · fixture dataset for testing only
        </div>
      )}
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <div className="text-sm font-bold tracking-[0.2em] text-primary uppercase">
              TRI//ARB
            </div>
            <div className="term-label">Bybit spot · public data · read-only</div>
          </div>
          <nav className="flex gap-1 text-xs">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-sm border border-transparent px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "border-primary/60 bg-primary/10 text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {proxied && <span className="term-label text-info">CORS PROXY</span>}
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 tracking-[0.14em] ${
                online
                  ? "border-profit/50 text-profit"
                  : "border-loss/50 text-loss"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-profit" : "bg-loss"} ${scanning ? "animate-pulse" : ""}`}
              />
              {online ? (scanning ? "SCANNING" : "LIVE") : "OFFLINE"}
            </span>
          </div>
        </div>
        {lastError && (
          <div className="border-t border-loss/40 bg-loss/10 px-4 py-1 text-xs text-loss">
            Feed error: {lastError}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-5">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-[1500px] px-4 pb-8 text-[0.65rem] text-muted-foreground">
        Prototype · no backend, no database, no API keys · all state is in browser memory and
        resets on reload · no orders are ever placed.
      </footer>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ScannerProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Chrome />
      </ScannerProvider>
    </QueryClientProvider>
  );
}
