export const BRANTA_LIGHT_LOGO = "/media/branta/branta-logo-light.png";
export const BRANTA_DARK_LOGO = "/media/branta/branta-logo.png";

// Resolve known image IDs already stored in CMS records to bundled assets.
const seededMedia: Record<string, string> = {
  "01f2baba-ceb1-4226-a48b-b74db94e7066/a2i-logo.png": "/media/branta/a2i-logo.png",
  "0b4ae587-c2b7-425d-a147-20db7ce842df/product-visual-1.png": "/media/branta/product-visual-1.webp",
  "1170fd89-f14a-4cf0-ba22-287abe248512/branta-logo.png": BRANTA_DARK_LOGO,
  "2aeb8a0a-9485-4d7a-9cb0-838a287ca45d/ugc-visual.png": "/media/branta/ugc-visual.png",
  "46721198-5a45-469d-b586-be13d2ecc99c/branta-logo-light.png": BRANTA_LIGHT_LOGO,
  "6172f38a-8226-4a59-a25a-e4b6c02f6e3c/fashion-visual.png": "/media/branta/fashion-visual.png",
  "826af1dd-2522-4e3f-af6a-2c4707b9f4c6/product-visual-2.webp": "/media/branta/product-visual-2.webp",
  "94e97320-3961-4e81-842f-fd405fa80f2d/open-lab-bangladesh-logo.png": "/media/branta/open-lab-bangladesh-logo.png",
  "b8e0f5af-9c8b-4cd8-9fe7-53ecc69c3343/bhtpa-logo.png": "/media/branta/bhtpa-seed-logo.png",
  "c931035a-2e1c-4ccf-be33-f32a5dab51dd/bhtpa-logo.png": "/media/branta/bhtpa-logo.png",
};

export function resolveBrantaMedia(url: string): string {
  const match = /^\/[^/?#]+\/[^/?#]+\/([a-f0-9-]{36}\/[^/?#]+)([?#].*)?$/.exec(url);
  const asset = match?.[1] ? seededMedia[match[1]] : undefined;
  return asset ? asset + (match?.[2] ?? "") : url;
}
