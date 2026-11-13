import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Login: o navegador manda o token em todo pedido a uma função do servidor; o servidor valida e roda com o acesso dessa pessoa.
const authFnMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { accessToken } = await import("./lib/auth-token");
    const token = await accessToken();
    return next({ headers: token ? { authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const [{ getRequest }, auth] = await Promise.all([import("@tanstack/react-start/server"), import("./lib/server-auth")]);
    const scope = await auth.resolveScope(auth.bearer(getRequest()));
    if (!scope) throw new Response(JSON.stringify({ error: "Entre na sua conta para continuar." }), { status: 401, headers: { "content-type": "application/json" } });
    return auth.runWithScope(scope, () => next());
  });

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  functionMiddleware: [authFnMiddleware],
}));
