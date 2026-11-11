import { safeUrl, toText } from "@nextomic/schema";
import { getTimeline } from "../animations";
import { FlowError, numberParam, type ActionHandler } from "./engine";
import type { Navigation } from "./handlers";

// Browser-only actions (docs/dynamic-data-and-actions.md section 8): scrolling, links and maps,
// sharing, the clipboard, sounds, screen reader announcements, light/dark mode and GSAP timelines.

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function scrollTarget(p: Record<string, unknown>): HTMLElement {
  const id = toText(p.element);
  const el = id ? document.querySelector<HTMLElement>(`[data-nid="${CSS.escape(id)}"]`) : null;
  if (!el) throw new FlowError("no-element", "The element is not on the page.");
  return el;
}

const link = (text: string, what: string): string => {
  const url = safeUrl(text);
  if (url === "") throw new FlowError("bad-url", `${what} must be an http(s), mailto or tel link.`);
  return url;
};

const query = (pairs: Record<string, string>): string => {
  const parts = Object.entries(pairs)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
};

const coordinate = (value: unknown, label: string, limit: number): string => {
  const n = Number(toText(value));
  if (toText(value).trim() === "" || !Number.isFinite(n) || Math.abs(n) > limit)
    throw new FlowError(
      "bad-coordinates",
      `${label} must be a number between -${limit} and ${limit}.`
    );
  return String(n);
};

/** The address of a map provider for an address or coordinates. */
export function mapUrl(p: Record<string, unknown>): string {
  const byAddress = toText(p.mode) !== "coordinates";
  const provider = toText(p.provider) || "google";
  let where: string;
  let lat = "";
  let lng = "";
  if (byAddress) {
    where = toText(p.address).trim();
    if (where === "") throw new FlowError("no-address", "Write the address to show.");
  } else {
    lat = coordinate(p.latitude, "Latitude", 90);
    lng = coordinate(p.longitude, "Longitude", 180);
    where = `${lat},${lng}`;
  }
  if (provider === "apple")
    return `https://maps.apple.com/${query(byAddress ? { q: where } : { ll: where })}`;
  if (provider === "osm")
    return byAddress
      ? `https://www.openstreetmap.org/search${query({ query: where })}`
      : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return `https://www.google.com/maps/search/${query({ api: "1", query: where })}`;
}

/** A hidden live region that screen readers read when its text changes. */
function liveRegion(politeness: "polite" | "assertive"): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-nx-live="${politeness}"]`);
  if (found) return found;
  const el = document.createElement("div");
  el.dataset.nxLive = politeness;
  el.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  el.setAttribute("aria-live", politeness);
  el.setAttribute("aria-atomic", "true");
  el.style.cssText =
    "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
  document.body.append(el);
  return el;
}

const MODE_KEY = "nxt-mode";

function applyMode(mode: string): void {
  const root = document.documentElement;
  const current = root.getAttribute("data-nxt-mode") ?? "light";
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const next =
    mode === "toggle"
      ? current === "dark"
        ? "light"
        : "dark"
      : mode === "system"
        ? systemDark
          ? "dark"
          : "light"
        : mode;
  if (next !== "light" && next !== "dark")
    throw new FlowError("bad-mode", "Choose light, dark, system or toggle.");
  root.setAttribute("data-nxt-mode", next);
  try {
    if (mode === "system") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, next);
  } catch {
    // Storage blocked: the mode still applies until the page closes.
  }
}

const phoneNumber = (value: unknown): string => {
  const number = toText(value).replace(/[^\d+*#,;]/g, "");
  if (number === "") throw new FlowError("no-number", "Write the phone number.");
  return number;
};

export function browserActionHandlers(navigation: Navigation): Record<string, ActionHandler> {
  const sounds = new Map<string, HTMLAudioElement>();
  const timeline = (p: Record<string, unknown>) => {
    const tl = getTimeline(toText(p.timeline));
    if (!tl) throw new FlowError("no-timeline", "That timeline is not running on this page.");
    return tl;
  };
  return {
    scrollTo: (p) => {
      const rect = scrollTarget(p).getBoundingClientRect();
      const align = toText(p.position);
      const base =
        align === "center"
          ? rect.top - (window.innerHeight - rect.height) / 2
          : align === "end"
            ? rect.bottom - window.innerHeight
            : rect.top;
      const top = window.scrollY + base - numberParam(p.offset, 0);
      const smooth = toText(p.smooth) !== "false" && !reducedMotion();
      window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    },
    launchUrl: (p) => {
      const url = link(toText(p.url), "The URL");
      if (toText(p.newTab) === "true") navigation.openTab(url);
      else navigation.open(url, false);
      return url;
    },
    launchMap: (p) => {
      const url = mapUrl(p);
      navigation.openTab(url);
      return url;
    },
    mailto: (p) => {
      const to = toText(p.to).trim();
      if (to === "") throw new FlowError("no-recipient", "Write who the email is for.");
      const recipients = to.split(",").map((address) => encodeURIComponent(address.trim()));
      const href = `mailto:${recipients.join(",")}${query({
        cc: toText(p.cc),
        bcc: toText(p.bcc),
        subject: toText(p.subject),
        body: toText(p.body)
      })}`;
      navigation.open(href, false);
      return href;
    },
    tel: (p) => {
      const href = `tel:${phoneNumber(p.number)}`;
      navigation.open(href, false);
      return href;
    },
    sms: (p) => {
      const href = `sms:${phoneNumber(p.number)}${query({ body: toText(p.body) })}`;
      navigation.open(href, false);
      return href;
    },
    share: async (p) => {
      if (typeof navigator.share !== "function")
        throw new FlowError("not-supported", "This browser cannot open a share sheet.");
      const url = toText(p.url).trim();
      try {
        await navigator.share({
          title: toText(p.title) || undefined,
          text: toText(p.text) || undefined,
          url: url === "" ? undefined : link(url, "The URL")
        });
      } catch (error) {
        if (error instanceof FlowError) throw error;
        // Closing the share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw new FlowError("share-failed", "The share sheet could not open.");
      }
    },
    "clipboard.copy": async (p) => {
      try {
        await navigator.clipboard.writeText(toText(p.text));
      } catch {
        throw new FlowError("clipboard-blocked", "The browser did not allow copying.");
      }
    },
    "sound.play": async (p) => {
      const src = link(toText(p.src), "The sound URL");
      sounds.get(src)?.pause();
      const audio = new Audio(src);
      audio.volume = Math.min(100, Math.max(0, numberParam(p.volume, 100))) / 100;
      audio.loop = toText(p.loop) === "true";
      sounds.set(src, audio);
      audio.addEventListener("ended", () => sounds.delete(src), { once: true });
      try {
        await audio.play();
      } catch {
        sounds.delete(src);
        throw new FlowError("sound-blocked", "The browser did not allow the sound to play.");
      }
    },
    "sound.stop": (p) => {
      const given = toText(p.src).trim();
      const only = given === "" ? null : link(given, "The sound URL");
      for (const [src, audio] of [...sounds]) {
        if (only !== null && src !== only) continue;
        audio.pause();
        audio.currentTime = 0;
        sounds.delete(src);
      }
    },
    "a11y.announce": (p) => {
      const message = toText(p.message).trim();
      if (message === "") throw new FlowError("no-message", "Write the message to announce.");
      const region = liveRegion(toText(p.politeness) === "assertive" ? "assertive" : "polite");
      // Clearing first makes a repeated message read again.
      region.textContent = "";
      window.setTimeout(() => (region.textContent = message), 50);
    },
    "uiMode.set": (p) => applyMode(toText(p.mode) || "toggle"),
    "gsap.start": (p) => {
      const tl = timeline(p);
      if (toText(p.fromStart) === "false") tl.play();
      else tl.restart();
    },
    "gsap.stop": (p) => {
      const tl = timeline(p);
      tl.pause();
      if (toText(p.reset) === "true") tl.progress(0);
    }
  };
}
