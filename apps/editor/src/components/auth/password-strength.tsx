"use client";

import { Icon } from "@/lib/icons/Icon";
import {
  passwordRules,
  passwordScore,
  SCORE_LABELS,
  type PasswordPolicy
} from "@/lib/password-policy";

const SCORE_COLOR = ["bg-default-200", "bg-danger", "bg-warning", "bg-primary", "bg-success"];
const SCORE_TEXT = [
  "text-default-500",
  "text-danger",
  "text-warning",
  "text-primary",
  "text-success"
];

/**
 * A coloured four-step strength bar and the policy's checklist (AUTH_PASSWORD_POLICY). The
 * checklist decides whether the password is allowed; the bar only shows how strong it is.
 */
export function PasswordStrength({
  password,
  policy
}: {
  password: string;
  policy: PasswordPolicy;
}) {
  const score = passwordScore(password);
  const rules = passwordRules(password, policy);
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div
          role="meter"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={score}
          aria-valuetext={SCORE_LABELS[score] || "Empty"}
          className="grid flex-1 grid-cols-4 gap-1.5"
        >
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1.5 rounded-full transition-colors duration-300 ${score >= step ? SCORE_COLOR[score] : "bg-default-200"}`}
            />
          ))}
        </div>
        <span className={`w-14 text-right text-tiny font-medium ${SCORE_TEXT[score]}`}>
          {SCORE_LABELS[score]}
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-center gap-1 text-tiny ${rule.met ? "text-success" : "text-default-500"}`}
          >
            {rule.met ? (
              <Icon name="ph:check-circle" width={12} height={12} />
            ) : (
              <Icon name="ph:circle" width={12} height={12} />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
