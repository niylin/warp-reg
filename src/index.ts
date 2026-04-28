import { registerWarp, formatWireGuard, formatMihomoWg, formatSingBoxWg } from "./warp";
import { enrollMasque, formatMasque, formatMihomoMasque, formatSingBoxMasque } from "./masque";

export interface Env {
  // Add environment variables here if needed
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/wg") {
      return handleWG(url);
    }

    if (path === "/masque") {
      return handleMasque(url);
    }

    return new Response(
      "Usage:\n\n/wg?format=[sing-box|mihomo]&jwt=[optional_token]\n/masque?format=[sing-box|mihomo]&jwt=[optional_token]\n\nExamples:\n/wg\n/wg?format=sing-box\n/wg?format=mihomo\n/masque\n/masque?format=sing-box\n/masque?format=mihomo",
      { status: 200 }
    );
  },
};

async function handleWG(url: URL): Promise<Response> {
  const format = url.searchParams.get("format") || "";
  const jwt = url.searchParams.get("jwt") || "";
  const model = url.searchParams.get("model") || "PC";
  const locale = url.searchParams.get("locale") || "en_US";

  try {
    const warpAccount = await registerWarp(model, locale, jwt);

    if (format === "sing-box") {
      return new Response(JSON.stringify(formatSingBoxWg(warpAccount), null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (format === "mihomo") {
      return new Response(formatMihomoWg(warpAccount), {
        headers: { "Content-Type": "text/yaml" },
      });
    }

    // Default: return WireGuard config
    return new Response(formatWireGuard(warpAccount), {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

async function handleMasque(url: URL): Promise<Response> {
  const format = url.searchParams.get("format") || "";
  const jwt = url.searchParams.get("jwt") || "";
  const model = url.searchParams.get("model") || "PC";
  const locale = url.searchParams.get("locale") || "en_US";

  try {
    // 1. Register Warp first
    const warpAccount = await registerWarp(model, locale, jwt);

    // 2. Enroll Masque
    const masqueAccount = await enrollMasque(warpAccount);

    if (format === "sing-box") {
      return new Response(JSON.stringify(formatSingBoxMasque(masqueAccount), null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (format === "mihomo") {
      return new Response(formatMihomoMasque(masqueAccount), {
        headers: { "Content-Type": "text/yaml" },
      });
    }

    // Default: return formatted JSON
    return new Response(JSON.stringify(formatMasque(masqueAccount), null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
