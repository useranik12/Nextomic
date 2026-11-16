import type { ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";

// Icons for the options of an element's select control. A registry option names its icon by key
// (`ControlDef.options[].icon`); the editor maps the key to a bundled icon here.
export function optionIcon(key: string | undefined): ReactNode {
  const props = { width: 16, height: 16 };
  switch (key) {
    case "text":
      return <Icon name="ph:text-aa" {...props} />;
    case "email":
      return <Icon name="ph:envelope-simple" {...props} />;
    case "number":
      return <Icon name="ph:hash" {...props} />;
    case "password":
      return <Icon name="ph:lock-simple" {...props} />;
    case "tel":
      return <Icon name="ph:phone" {...props} />;
    case "url":
      return <Icon name="ph:link" {...props} />;
    case "search":
      return <Icon name="ph:magnifying-glass" {...props} />;
    case "textarea":
      return <Icon name="ph:text-align-left" {...props} />;
    default:
      return null;
  }
}
