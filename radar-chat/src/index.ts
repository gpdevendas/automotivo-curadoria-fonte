import { createToken, verifyToken, extractBearerToken } from "./auth";
import { montarSystemPrompt, type DocumentoEnviado } from "./context";
import { perguntarGemini } from "./gemini";

export interface Env {
  ASSETS: { fetch: typeof fetch };
  UPLOADS: R2Bucket;
  GEMINI_API_KEY: string;
  CHAT_PASSWORD: string;
  SESSION_SECRET: string;
}

const UPLOAD_KEY = "current.txt";
const UPLOAD_LIMITE_BYTES = 500 * 1024;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function exigirSessaoValida(req: Request, env: Env): Promise<boolean> {
  const token = extractBearerToken(req);
  return verifyToken(token, env.SESSION_SECRET);
}

async function lerDocumentoAtual(env: Env): Promise<DocumentoEnviado | null> {
  const obj = await env.UPLOADS.get(UPLOAD_KEY);
  if (!obj) return null;
  const content = await obj.text();
  const filename = obj.customMetadata?.filename ?? "documento.txt";
  const uploadedAt = obj.customMetadata?.uploadedAt ?? obj.uploaded.toISOString();
  return { filename, uploadedAt, content };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/login") {
      const body = await req.json<{ password?: string }>().catch(() => ({}));
      if (!body.password || body.password !== env.CHAT_PASSWORD) {
        return json({ error: "Senha incorreta." }, 401);
      }
      const token = await createToken(env.SESSION_SECRET);
      return json({ token });
    }

    if (req.method === "GET" && url.pathname === "/verify") {
      const ok = await exigirSessaoValida(req, env);
      return json({ valid: ok }, ok ? 200 : 401);
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      if (!(await exigirSessaoValida(req, env))) return json({ error: "Sessão inválida." }, 401);
      const body = await req.json<{ message?: string }>().catch(() => ({}));
      if (!body.message || !body.message.trim()) {
        return json({ error: "Mensagem vazia." }, 400);
      }
      try {
        const documento = await lerDocumentoAtual(env);
        const systemPrompt = montarSystemPrompt(documento);
        const reply = await perguntarGemini(env.GEMINI_API_KEY, systemPrompt, body.message.trim());
        return json({ reply });
      } catch (err) {
        return json({ error: String(err instanceof Error ? err.message : err) }, 502);
      }
    }

    if (req.method === "POST" && url.pathname === "/upload") {
      if (!(await exigirSessaoValida(req, env))) return json({ error: "Sessão inválida." }, 401);
      const body = await req.json<{ filename?: string; content?: string }>().catch(() => ({}));
      if (!body.filename || !body.content) {
        return json({ error: "Arquivo ou conteúdo faltando." }, 400);
      }
      if (!/\.(txt|md)$/i.test(body.filename)) {
        return json({ error: "Só são aceitos arquivos .txt ou .md." }, 400);
      }
      const bytes = new TextEncoder().encode(body.content);
      if (bytes.byteLength > UPLOAD_LIMITE_BYTES) {
        return json({ error: "Arquivo muito grande (limite 500 KB)." }, 400);
      }
      await env.UPLOADS.put(UPLOAD_KEY, bytes, {
        customMetadata: { filename: body.filename, uploadedAt: new Date().toISOString() },
      });
      return json({ ok: true });
    }

    return env.ASSETS.fetch(req);
  },
};
