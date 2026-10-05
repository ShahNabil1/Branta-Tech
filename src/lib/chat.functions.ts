import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Branta Assistant RPC entry points; all logic lives in chat.server.ts (server-only). */
const SendShape = z.object({ token: z.string().max(100).nullable() }).passthrough();

export const chatOpen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(100).nullable() }).parse(d))
  .handler(async ({ data }) => (await import("./chat.server")).doOpen(data));

export const chatSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(100), after: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => (await import("./chat.server")).doSync(data));

export const chatSend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SendShape.parse(d) as Record<string, unknown>)
  .handler(async ({ data }) => {
    const m = await import("./chat.server");
    const parsed = m.SendInput.safeParse(data);
    if (!parsed.success) return { ok: false as const, error: "Please check your message and try again." };
    return m.doSend(parsed.data);
  });
