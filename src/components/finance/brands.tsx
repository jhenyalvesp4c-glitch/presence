/** Logos das principais assinaturas (streaming, música, jogos, nuvem, IA, apps). Tudo embutido: nada é buscado na internet. */
import type { ReactNode } from "react";
import {
  siApple, siAudible, siClaude, siCloudflare, siCoursera, siCrunchyroll, siCursor, siDeezer, siDiscord, siDropbox, siDuolingo, siEvernote, siFigma,
  siFortnite, siGoogle, siHeadspace, siInstagram, siMax, siMedium, siNetflix, siNotion, siNubank, siPeloton, siPerplexity, siPicpay, siPinterest, siReddit,
  siShopify, siSkillshare, siSnapchat, siSpotify, siStrava, siSupabase, siSteam, siTelegram, siTidal, siTodoist, siTrello, siTwitch, siUber, siUdemy,
  siVercel, siWix, siX, siZapier, siZoom,
} from "simple-icons";

type Icon = { path: string; hex: string };
export type Brand = { id: string; name: string; re: RegExp; bg: string; glow: string; glyph: ReactNode };

const lum = (hex: string) => { const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
/** Logo do pacote de ícones: fundo na cor da marca e símbolo claro (ou escuro, se a marca for clara). */
const icon = (id: string, name: string, re: RegExp, i: Icon, o: { bg?: string; fg?: string } = {}): Brand => {
  const bg = o.bg ?? `#${i.hex}`, fg = o.fg ?? (lum(o.bg ? o.bg.replace("#", "") : i.hex) > 0.62 ? "#111" : "#fff");
  return { id, name, re, bg, glow: bg.startsWith("#") && lum(bg.slice(1)) < 0.12 ? "#7c8cff" : bg, glyph: <path d={i.path} fill={fg} /> };
};
const txt = (s: string, o: { size?: number; weight?: number; italic?: boolean; family?: string; fill?: string } = {}) => (
  <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill={o.fill ?? "#fff"} fontSize={o.size ?? 7.5} fontWeight={o.weight ?? 800} fontStyle={o.italic ? "italic" : "normal"} fontFamily={o.family ?? "Manrope, system-ui, sans-serif"}>{s}</text>
);

export const BRANDS: Brand[] = [
  icon("netflix", "Netflix", /netflix/i, siNetflix, { bg: "#000", fg: "#E50914" }),
  icon("spotify", "Spotify", /spotify/i, siSpotify),
  { id: "prime", name: "Prime Video", re: /\bprime\b|amazon/i, bg: "#00A8E1", glow: "#00A8E1", glyph: <>{txt("prime", { size: 6.6, weight: 800 })}<path d="M5 16.2c4.5 2.6 10 2.6 14 0" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" /><path d="M17.6 14.8l1.8 1.3-2.1.8z" fill="#fff" /></> },
  { id: "disney", name: "Disney+", re: /disney/i, bg: "#0B1F6B", glow: "#3a5bff", glyph: txt("Disney+", { size: 6, weight: 700, italic: true, family: "Georgia, serif" }) },
  { id: "youtube", name: "YouTube", re: /youtube|yt ?(premium|music)/i, bg: "#FF0000", glow: "#FF0000", glyph: <path d="M9 7v10l8.5-5z" fill="#fff" /> },
  icon("max", "Max", /\bmax\b|hbo/i, siMax, { bg: "#002BE7", fg: "#fff" }),
  { id: "applemusic", name: "Apple Music", re: /apple ?music/i, bg: "linear-gradient(135deg,#FA233B,#FB5C74)", glow: "#FA233B", glyph: <path d="M16.5 5.2v10.1a2.4 2.4 0 1 1-1.4-2.2V8.3l-5.6 1.2v7a2.4 2.4 0 1 1-1.4-2.2V7.2z" fill="#fff" /> },
  { id: "appletv", name: "Apple TV+", re: /apple ?tv/i, bg: "#000", glow: "#9aa4b8", glyph: txt("tv+", { size: 8, weight: 700 }) },
  { id: "icloud", name: "iCloud", re: /icloud/i, bg: "linear-gradient(135deg,#3693F3,#6ec1ff)", glow: "#3693F3", glyph: <path d="M7.2 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.7a4.6 4.6 0 0 1 .3 9.3z" fill="#fff" /> },
  icon("apple", "Apple", /apple/i, siApple, { bg: "#000", fg: "#fff" }),
  { id: "googleone", name: "Google One", re: /google ?(one|drive)|google/i, bg: "#fff", glow: "#4285F4", glyph: <path d={siGoogle.path} fill="#4285F4" /> },
  { id: "xbox", name: "Xbox", re: /xbox|game ?pass/i, bg: "#107C10", glow: "#2fd02f", glyph: <><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></> },
  { id: "playstation", name: "PlayStation", re: /playstation|psn|ps ?plus/i, bg: "#003791", glow: "#2f6bff", glyph: txt("PS", { size: 9, weight: 800, italic: true }) },
  icon("twitch", "Twitch", /twitch/i, siTwitch),
  icon("fortnite", "Fortnite", /fortnite/i, siFortnite, { bg: "#1b1f3b", fg: "#fff" }),
  icon("steam", "Steam", /steam/i, siSteam, { bg: "#1b2838", fg: "#fff" }),
  icon("crunchyroll", "Crunchyroll", /crunchyroll/i, siCrunchyroll),
  icon("deezer", "Deezer", /deezer/i, siDeezer, { bg: "#121216", fg: "#A238FF" }),
  icon("tidal", "Tidal", /tidal/i, siTidal, { bg: "#000", fg: "#fff" }),
  icon("audible", "Audible", /audible/i, siAudible),
  { id: "kindle", name: "Kindle", re: /kindle/i, bg: "#232F3E", glow: "#FF9900", glyph: <>{txt("kindle", { size: 6.4, weight: 700 })}<path d="M5 17c4.5 2.2 9.5 2.2 14 0" stroke="#FF9900" strokeWidth="1.3" fill="none" strokeLinecap="round" /></> },
  { id: "globoplay", name: "Globoplay", re: /globo/i, bg: "linear-gradient(135deg,#ff6a3a,#c4166a)", glow: "#ff6a3a", glyph: <><circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M10.2 8.8v6.4l5-3.2z" fill="#fff" /></> },
  { id: "paramount", name: "Paramount+", re: /paramount/i, bg: "#0064FF", glow: "#0064FF", glyph: <><path d="M3 17.5l6.2-9.5 3 4.6 2.2-3 5.6 7.9z" fill="#fff" /><path d="M18.5 4.5v3.4M16.8 6.2h3.4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /></> },
  { id: "ifood", name: "iFood", re: /ifood/i, bg: "#EA1D2C", glow: "#EA1D2C", glyph: txt("iFood", { size: 6.8, weight: 800 }) },
  icon("uber", "Uber", /uber/i, siUber, { bg: "#000", fg: "#fff" }),
  { id: "ms365", name: "Microsoft 365", re: /microsoft|office|365|onedrive/i, bg: "#1b1b1f", glow: "#00A4EF", glyph: <><rect x="4.5" y="4.5" width="7" height="7" fill="#F25022" /><rect x="12.5" y="4.5" width="7" height="7" fill="#7FBA00" /><rect x="4.5" y="12.5" width="7" height="7" fill="#00A4EF" /><rect x="12.5" y="12.5" width="7" height="7" fill="#FFB900" /></> },
  { id: "adobe", name: "Adobe", re: /adobe|photoshop|creative cloud/i, bg: "#FA0F00", glow: "#FA0F00", glyph: <path d="M13.97 18.8l-1.2-3.05H9.8l-2.2 5.2H2.2L9.9 3h4.3L22 21h-5.4zM9.2 3H2v18z" transform="translate(1.1 .9) scale(.9)" fill="#fff" /> },
  { id: "canva", name: "Canva", re: /canva/i, bg: "linear-gradient(135deg,#00C4CC,#7D2AE8)", glow: "#7D2AE8", glyph: txt("Canva", { size: 6.3, weight: 700, italic: true }) },
  { id: "openai", name: "ChatGPT", re: /chat ?gpt|openai|gpt/i, bg: "#10A37F", glow: "#10A37F", glyph: <><path d="M12 3.8l6.9 4v8.4l-6.9 4-6.9-4V7.8z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.4" fill="none" stroke="#fff" strokeWidth="1.5" /></> },
  icon("claude", "Claude", /claude|anthropic/i, siClaude),
  icon("perplexity", "Perplexity", /perplexity/i, siPerplexity),
  icon("cursor", "Cursor", /cursor/i, siCursor, { bg: "#14120b", fg: "#fff" }),
  icon("notion", "Notion", /notion/i, siNotion, { bg: "#fff", fg: "#000" }),
  icon("dropbox", "Dropbox", /dropbox/i, siDropbox),
  icon("figma", "Figma", /figma/i, siFigma),
  icon("evernote", "Evernote", /evernote/i, siEvernote),
  icon("todoist", "Todoist", /todoist/i, siTodoist),
  icon("trello", "Trello", /trello/i, siTrello),
  icon("zapier", "Zapier", /zapier/i, siZapier),
  icon("zoom", "Zoom", /zoom/i, siZoom),
  icon("discord", "Discord", /discord/i, siDiscord),
  icon("telegram", "Telegram", /telegram/i, siTelegram),
  icon("vercel", "Vercel", /vercel/i, siVercel, { bg: "#000", fg: "#fff" }),
  icon("supabase", "Supabase", /supabase/i, siSupabase),
  icon("cloudflare", "Cloudflare", /cloudflare/i, siCloudflare),
  icon("wix", "Wix", /\bwix\b/i, siWix),
  icon("shopify", "Shopify", /shopify/i, siShopify),
  icon("duolingo", "Duolingo", /duolingo/i, siDuolingo),
  icon("coursera", "Coursera", /coursera/i, siCoursera),
  icon("udemy", "Udemy", /udemy/i, siUdemy),
  icon("skillshare", "Skillshare", /skillshare/i, siSkillshare),
  icon("headspace", "Headspace", /headspace/i, siHeadspace),
  icon("strava", "Strava", /strava/i, siStrava),
  icon("peloton", "Peloton", /peloton/i, siPeloton, { bg: "#000", fg: "#fff" }),
  icon("medium", "Medium", /medium/i, siMedium, { bg: "#000", fg: "#fff" }),
  icon("reddit", "Reddit", /reddit/i, siReddit),
  icon("pinterest", "Pinterest", /pinterest/i, siPinterest),
  icon("snapchat", "Snapchat", /snapchat/i, siSnapchat),
  icon("instagram", "Instagram", /instagram/i, siInstagram, { bg: "linear-gradient(135deg,#feda75,#fa7e1e 30%,#d62976 60%,#962fbf 80%,#4f5bd5)", fg: "#fff" }),
  icon("x", "X", /^x$|twitter|x premium/i, siX, { bg: "#000", fg: "#fff" }),
  icon("nubank", "Nubank", /nubank|nu ?conta/i, siNubank),
  icon("picpay", "PicPay", /picpay/i, siPicpay),
  { id: "linkedin", name: "LinkedIn", re: /linkedin/i, bg: "#0A66C2", glow: "#0A66C2", glyph: txt("in", { size: 11, weight: 800 }) },
  { id: "gympass", name: "Wellhub", re: /gympass|wellhub|totalpass|academia|smart ?fit|bluefit/i, bg: "#F5B800", glow: "#F5B800", glyph: <path d="M7 9.2v5.6M17 9.2v5.6M4.6 10.8v2.4M19.4 10.8v2.4M7 12h10" stroke="#111" strokeWidth="1.8" strokeLinecap="round" /> },
];

/** Marca reconhecida pelo nome da assinatura (ou nada, se não for uma das conhecidas). */
export const brandOf = (name: string): Brand | null => BRANDS.find((b) => b.re.test(name)) ?? null;

/** Quadradinho com o logo da marca. */
export function BrandTile({ brand, size = 56, className = "", paused = false }: { brand: Brand; size?: number; className?: string; paused?: boolean }) {
  return (
    <span aria-label={brand.name} role="img" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl transition ${paused ? "grayscale" : ""} ${className}`}
      style={{ width: size, height: size, background: brand.bg, boxShadow: paused ? undefined : `0 10px 28px -10px ${brand.glow}, inset 0 1px 0 rgba(255,255,255,.25)` }}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden>{brand.glyph}</svg>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
    </span>
  );
}

/** As mais usadas, para sugerir ao cadastrar. */
export const POPULAR: string[] = ["netflix", "spotify", "prime", "disney", "youtube", "max", "applemusic", "icloud", "googleone", "xbox", "playstation", "openai", "claude", "canva", "ms365", "adobe", "globoplay", "paramount", "kindle", "gympass"];
export const popularBrands = (): Brand[] => POPULAR.map((id) => BRANDS.find((b) => b.id === id)!).filter(Boolean);
