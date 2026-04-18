# Warp API

A Cloudflare Workers API to register Warp and MASQUE accounts.

## Usage

- `/reg?type=wg`: Register a Warp account and return WireGuard config.
- `/reg?type=wg&format=mihomo`: Register a Warp account and return Mihomo (Clash) compatible WireGuard config.
- `/reg?type=masque`: Register a Warp account and enroll it in MASQUE, then return MASQUE config.
- `/reg?type=masque&format=mihomo`: Register a Warp account and return Mihomo compatible MASQUE config.
- `/reg?type=json`: Return the full account data in JSON format.

## Development

The project is structured into modules:
- `src/index.ts`: Entry point and routing.
- `src/warp.ts`: Warp registration logic.
- `src/masque.ts`: MASQUE enrollment logic.
- `src/crypto.ts`: Key generation utilities (X25519 for Warp, P-256 for MASQUE).
- `src/config.ts`: Constants.
