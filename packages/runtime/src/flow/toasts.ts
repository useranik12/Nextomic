import { Z_BANDS } from "@nextomic/schema";

// Native toasts (owner decision 2026-11-11): Show Toast builds the message itself, with the look
// of the HeroUI toast by default. Text goes in as text, never as HTML. The global toast design
// moves to the theme editor in a later phase.

export interface ToastOptions {
  title: string;
  message?: string;
  buttonText?: string;
  onButton?: () => void;
  buttonColor?: string;
  buttonTextColor?: string;
  backgroundColor?: string;
  titleColor?: string;
  messageColor?: string;
  borderStyle?: string;
  borderWidthPx?: number;
  borderColor?: string;
  borderRadiusPx?: number;
  /** Milliseconds; 0 keeps the toast until it is dismissed. */
  hideAfterMs: number;
  hidePrevious: boolean;
}

export interface ToastStack {
  show: (options: ToastOptions) => void;
  dismiss: (which: "current" | "all") => void;
  destroy: () => void;
}

const BORDER_STYLES = new Set(["none", "solid", "dashed", "dotted"]);

function line(tag: "p" | "button", css: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.style.cssText = css;
  el.textContent = text;
  return el;
}

export function createToastStack(): ToastStack {
  const live: { el: HTMLElement; close: () => void }[] = [];
  let host: HTMLElement | null = null;

  const hostEl = (): HTMLElement => {
    if (host?.isConnected) return host;
    host = document.createElement("div");
    host.dataset.nxToasts = "";
    host.style.cssText = `position:fixed;right:16px;bottom:16px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;z-index:${Z_BANDS.toast}`;
    document.body.append(host);
    return host;
  };

  const show = (o: ToastOptions) => {
    if (o.hidePrevious) for (const t of [...live]) t.close();
    const el = document.createElement("div");
    el.dataset.nxToast = "";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    const border = BORDER_STYLES.has(o.borderStyle ?? "") ? (o.borderStyle ?? "solid") : "solid";
    el.style.cssText =
      "pointer-events:auto;box-sizing:border-box;width:356px;max-width:100%;display:flex;align-items:flex-start;gap:12px;padding:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0 / 0.16);";
    el.style.background = o.backgroundColor || "#ffffff";
    el.style.borderStyle = border;
    el.style.borderWidth = `${border === "none" ? 0 : (o.borderWidthPx ?? 1)}px`;
    el.style.borderColor = o.borderColor || "rgb(17 17 17 / 0.15)";
    el.style.borderRadius = `${o.borderRadiusPx ?? 12}px`;

    const body = document.createElement("div");
    body.style.cssText = "flex:1;min-width:0";
    body.append(
      line(
        "p",
        `margin:0;font-weight:500;color:${o.titleColor || "#11181c"};overflow-wrap:anywhere`,
        o.title
      )
    );
    if (o.message)
      body.append(
        line(
          "p",
          `margin:2px 0 0;color:${o.messageColor || "#71717a"};overflow-wrap:anywhere`,
          o.message
        )
      );
    el.append(body);

    let timer = 0;
    const close = () => {
      window.clearTimeout(timer);
      const at = live.findIndex((t) => t.el === el);
      if (at >= 0) live.splice(at, 1);
      el.remove();
    };
    if (o.buttonText) {
      const button = line(
        "button",
        `flex:none;cursor:pointer;border:0;border-radius:8px;padding:4px 10px;font:inherit;font-weight:500;background:${o.buttonColor || "#006fee"};color:${o.buttonTextColor || "#ffffff"}`,
        o.buttonText
      );
      button.addEventListener("click", () => {
        o.onButton?.();
        close();
      });
      el.append(button);
    }
    const closeButton = line(
      "button",
      `flex:none;cursor:pointer;border:0;background:none;padding:0 2px;font-size:18px;line-height:1;color:${o.messageColor || "#71717a"}`,
      "×"
    );
    closeButton.setAttribute("aria-label", "Dismiss");
    closeButton.addEventListener("click", close);
    el.append(closeButton);

    hostEl().append(el);
    live.push({ el, close });
    if (o.hideAfterMs > 0) timer = window.setTimeout(close, o.hideAfterMs);
  };

  return {
    show,
    dismiss: (which) => {
      if (which === "all") for (const t of [...live]) t.close();
      else live[live.length - 1]?.close();
    },
    destroy: () => {
      for (const t of [...live]) t.close();
      host?.remove();
      host = null;
    }
  };
}
