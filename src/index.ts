import { registerWarp, formatWireGuard, formatMihomoWg } from "./warp";
import { enrollMasque, formatMasque, formatMihomoMasque } from "./masque";

export interface Env {
  // Add environment variables here if needed
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/reg") {
      return handleRegister(url);
    }

    return new Response(
      "Usage: /reg?type=[wg|masque|json]&format=[mihomo|json]&jwt=[optional_token]\n\nExample:\n/reg?type=wg&format=mihomo\n/reg?type=masque&format=mihomo",
      { status: 200 }
    );
  },
};

async function handleRegister(url: URL): Promise<Response> {
  const type = url.searchParams.get("type") || "json";
  const format = url.searchParams.get("format") || "";
  const jwt = url.searchParams.get("jwt") || "";
  const model = url.searchParams.get("model") || "PC";
  const locale = url.searchParams.get("locale") || "en_US";

  try {
    // 1. Warp Registration (always needed as base)
    const warpAccount = await registerWarp(model, locale, jwt);

    // 2. Format based on type
    if (type === "wg") {
      if (format === "mihomo") {
        return new Response(formatMihomoWg(warpAccount), {
          headers: { "Content-Type": "text/yaml" },
        });
      }
      return new Response(formatWireGuard(warpAccount), {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (type === "masque" || type === "json") {
      // 3. Enroll MASQUE if requested
      const masqueAccount = await enrollMasque(warpAccount);

      if (type === "masque") {
        if (format === "mihomo") {
          return new Response(formatMihomoMasque(masqueAccount), {
            headers: { "Content-Type": "text/yaml" },
          });
        }
        return new Response(JSON.stringify(formatMasque(masqueAccount), null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(masqueAccount, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(warpAccount, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
