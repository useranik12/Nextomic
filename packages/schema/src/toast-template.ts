import type { ElementNode } from "./element";
import { emptyPageTree } from "./page";

// The design a new toast template starts with, modeled on the HeroUI toast (a card with a colored
// dot, title, message and close button) and built from ordinary Nextomic elements and styles, so
// the user restyles it like any template. {{ toast.* }} carries what Show Toast sent.

/** Show Toast types and the dot color each gets in the starter design. */
export const TOAST_TYPES = ["default", "success", "warning", "danger"] as const;
export type ToastType = (typeof TOAST_TYPES)[number];

const TYPE_COLOR =
  '{{ toast.type == "success" ? "#17c964" : toast.type == "warning" ? "#f5a524" : ' +
  'toast.type == "danger" ? "#f31260" : "#006fee" }}';

const node = (
  type: string,
  name: string,
  base: Record<string, string>,
  extra: Partial<ElementNode> = {}
): ElementNode => ({
  id: crypto.randomUUID(),
  type,
  name,
  classIds: [],
  props: {},
  styles: { breakpoints: { base: { default: base } } },
  actions: {},
  children: [],
  ...extra
});

export function defaultToastTree(): ElementNode {
  const card = node(
    "container",
    "Toast",
    {
      display: "flex",
      "align-items": "flex-start",
      gap: "12px",
      width: "356px",
      "max-width": "calc(100vw - 32px)",
      padding: "12px 16px",
      "border-radius": "12px",
      border: "1px solid #e4e4e7",
      "background-color": "#ffffff",
      color: "#11181c",
      "box-shadow": "0 8px 30px rgba(0, 0, 0, 0.12)"
    },
    { attributes: { role: "status" } }
  );
  const dot = node("container", "Type dot", {
    "flex-shrink": "0",
    width: "8px",
    height: "8px",
    "margin-top": "6px",
    "border-radius": "9999px",
    "background-color": TYPE_COLOR
  });
  const body = node("container", "Content", {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    "flex-grow": "1",
    "min-width": "0"
  });
  const title = node(
    "text",
    "Title",
    { "font-size": "14px", "font-weight": "600", "line-height": "20px", margin: "0" },
    { props: { text: "{{ toast.title }}" } }
  );
  const message = node(
    "text",
    "Message",
    { "font-size": "13px", "line-height": "18px", color: "#71717a", margin: "0" },
    { props: { text: "{{ toast.message }}" } }
  );
  const close = node(
    "button",
    "Close",
    {
      "flex-shrink": "0",
      padding: "0 4px",
      border: "0",
      background: "transparent",
      color: "#71717a",
      "font-size": "16px",
      "line-height": "20px",
      cursor: "pointer"
    },
    {
      props: { text: "×", href: "" },
      htmlTag: "button",
      attributes: { "aria-label": "Close", "data-nx-toast-close": "" }
    }
  );
  body.children = [title, message];
  card.children = [dot, body, close];
  return { ...emptyPageTree(), name: "Toast", children: [card] };
}
