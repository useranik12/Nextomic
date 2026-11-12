import { Icon } from "@/lib/icons/Icon";

/** Shown on a theme that follows the primary: values are its own, names and structure are not. */
export function FollowBanner({ primary }: { primary: string }) {
  return (
    <p className="mx-3 mt-2 flex items-start gap-2 rounded-xl bg-default px-3 py-2 text-xs text-body">
      <Icon name="ph:link" width={14} height={14} className="mt-0.5 shrink-0" />
      <span>
        This theme follows <strong>{primary}</strong>. You can change values here; names, classes
        and structure come from {primary}. Turn off Follow Primary in Themes to make them its own.
      </span>
    </p>
  );
}
