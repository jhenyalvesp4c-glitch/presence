import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import { HealthPreviewProvider } from "@/components/health-preview-provider";
import { OrionDock } from "@/components/orion/OrionDock";
import { VoiceDock } from "@/components/voice/VoiceDock";
import { ReminderWatcher } from "@/components/reminders/ReminderWatcher";
import { UpdateWatcher } from "@/components/UpdateWatcher";
import { WhatsAppWatcher } from "@/components/whatsapp/WhatsAppWatcher";
import { GlobalRail, useRailPad } from "@/components/GlobalRail";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TouchTargets } from "@/components/TouchTargets";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ZoomHint } from "@/components/ZoomHint";
import { VoiceProvider } from "@/lib/voice/use-voice";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/auth/AuthGate";
import { BriefingProvider } from "@/lib/use-briefing";
import { BriefingFlow } from "@/components/briefing/BriefingFlow";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

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
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#070a1d" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Orion" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Orion · Assistente pessoal" },
      { name: "description", content: "Orion, seu assistente pessoal para rotina, saúde, foco e finanças." },
      { property: "og:title", content: "Orion · Assistente pessoal" },
      { property: "og:description", content: "Seu assistente pessoal futurista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** Se o app não terminar de carregar em 12 s (erro de configuração, sem internet, versão antiga guardada), mostra o motivo em vez de ficar parado na tela de abertura. */
const BOOT_WATCHDOG = `(function(){var err="";window.addEventListener("error",function(e){if(!err&&e&&e.message)err=String(e.message)});window.addEventListener("unhandledrejection",function(e){if(!err&&e&&e.reason)err=String(e.reason&&e.reason.message||e.reason)});
setTimeout(function(){if(window.__orionOk)return;var d=document.createElement("div");d.setAttribute("role","alert");d.setAttribute("data-testid","boot-watchdog");
d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:min(560px,92vw);padding:16px 18px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(8,10,20,.96);color:#e8ecf5;font:14px/1.5 system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6)";
var hint=/VITE_SUPABASE|Defina VITE/.test(err)?"Faltam as chaves de acesso no arquivo .env deste computador (VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY).":"Pode ser falta de internet, o arquivo .env deste computador sem as chaves (VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY) ou uma versão antiga guardada.";
d.innerHTML="<b>O Orion não terminou de carregar.</b><br>"+hint+(err?'<br><span style="opacity:.7;font-size:12px">Detalhe: '+err.replace(/[<>&]/g,"")+"</span>":"")+'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="ow-r" style="padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;cursor:pointer">Recarregar</button><button id="ow-c" style="padding:8px 14px;border-radius:10px;border:0;background:linear-gradient(90deg,#22d3ee,#a78bfa);color:#04121a;font-weight:600;cursor:pointer">Limpar o que ficou guardado e recarregar</button></div>';
document.body.appendChild(d);document.getElementById("ow-r").onclick=function(){location.reload()};
document.getElementById("ow-c").onclick=function(){try{Object.keys(localStorage).filter(function(k){return k.indexOf("presence-app-auth")===0||k.indexOf("sb-")===0}).forEach(function(k){localStorage.removeItem(k)})}catch(e){}
var jobs=[];try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister()}))}))}catch(e){}try{if(window.caches)jobs.push(caches.keys().then(function(k){return Promise.all(k.map(function(x){return caches.delete(x)}))}))}catch(e){}
Promise.all(jobs).catch(function(){}).then(function(){location.reload()})}},12000)})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: BOOT_WATCHDOG }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const railPad = useRailPad();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <ServiceWorkerRegistration />
      <AuthProvider><AuthGate><BriefingProvider>
      <VoiceProvider>
        <GlobalRail />
        <MobileTabBar />
        <ZoomHint />
        <div className={railPad}><HealthPreviewProvider><Outlet /></HealthPreviewProvider></div>
        {/* espaço no fim da página: o conteúdo rola até acima dos botões flutuantes */}
        <div aria-hidden className="h-16 md:hidden" />
        <TouchTargets />
        <OrionDock />
        <VoiceDock />
        <ReminderWatcher />
        <UpdateWatcher />
        <WhatsAppWatcher />
      </VoiceProvider>
        <BriefingFlow />
      </BriefingProvider></AuthGate></AuthProvider>
      <Toaster position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}
