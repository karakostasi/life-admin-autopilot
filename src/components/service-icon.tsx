import { siApple, siClaude, siDropbox, siGoogle, siHbomax, siNetflix, siSpotify, siYoutube, type SimpleIcon } from "simple-icons";
import { knownService } from "@/lib/subscriptions";

// Λογότυπα από το simple-icons (CC0). Όσα brands δεν υπάρχουν εκεί (Disney+, Prime, Microsoft, Adobe, ChatGPT)
// εμφανίζονται ως αρχικό γράμμα στο χρώμα του brand.
const LOGOS: Record<string, SimpleIcon> = {
  Netflix: siNetflix,
  "YouTube Premium": siYoutube,
  Spotify: siSpotify,
  "HBO Max": siHbomax,
  "Apple (iCloud / App Store)": siApple,
  "Google One": siGoogle,
  Claude: siClaude,
  Dropbox: siDropbox,
};

const INITIALS: Record<string, { letter: string; hex: string }> = {
  "Disney+": { letter: "D+", hex: "113CCF" },
  "Amazon Prime": { letter: "P", hex: "00A8E1" },
  "Microsoft 365": { letter: "M", hex: "0078D4" },
  Adobe: { letter: "A", hex: "FA0F00" },
  ChatGPT: { letter: "G", hex: "10A37F" },
};

export function ServiceIcon({ merchant, size = "md" }: { merchant: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-xl";
  const name = knownService(merchant);
  const logo = name ? LOGOS[name] : undefined;
  const initial = name ? INITIALS[name] : undefined;

  if (logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center ${box}`} style={{ backgroundColor: `#${logo.hex === "000000" ? "1f2937" : logo.hex}` }} aria-hidden>
        <svg viewBox="0 0 24 24" className={size === "sm" ? "h-4 w-4" : "h-6 w-6"} fill="#fff">
          <path d={logo.path} />
        </svg>
      </span>
    );
  }
  if (initial) {
    return (
      <span className={`flex shrink-0 items-center justify-center text-sm font-bold text-white ${box}`} style={{ backgroundColor: `#${initial.hex}` }} aria-hidden>
        {initial.letter}
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center bg-indigo-50 ${size === "sm" ? "text-base" : "text-2xl"} ${box}`} aria-hidden>
      🔁
    </span>
  );
}
