// Password rules for builder accounts, chosen with AUTH_PASSWORD_POLICY. Shared by the server
// (enforced on sign-up, reset and change) and the browser (strength meter and live checklist).

export type PasswordPolicyName = "basic" | "medium" | "strong" | "very-strong";

export interface PasswordPolicy {
  name: PasswordPolicyName;
  minLength: number;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

export const PASSWORD_POLICIES: Record<PasswordPolicyName, PasswordPolicy> = {
  basic: {
    name: "basic",
    minLength: 8,
    lowercase: false,
    uppercase: false,
    number: false,
    symbol: false
  },
  medium: {
    name: "medium",
    minLength: 10,
    lowercase: true,
    uppercase: false,
    number: true,
    symbol: false
  },
  strong: {
    name: "strong",
    minLength: 12,
    lowercase: true,
    uppercase: true,
    number: true,
    symbol: true
  },
  "very-strong": {
    name: "very-strong",
    minLength: 16,
    lowercase: true,
    uppercase: true,
    number: true,
    symbol: true
  }
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicyName = "medium";
export const MAX_PASSWORD_LENGTH = 128;

/** The policy named by AUTH_PASSWORD_POLICY; unknown or empty values fall back to "medium". */
export function passwordPolicyFromEnv(value: string | undefined): PasswordPolicy {
  const name = (value ?? "").trim().toLowerCase() as PasswordPolicyName;
  return PASSWORD_POLICIES[name] ?? PASSWORD_POLICIES[DEFAULT_PASSWORD_POLICY];
}

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** Each requirement of the policy and whether `password` meets it. */
export function passwordRules(password: string, policy: PasswordPolicy): PasswordRule[] {
  const rules: PasswordRule[] = [
    { label: `At least ${policy.minLength} characters`, met: password.length >= policy.minLength }
  ];
  if (policy.lowercase) rules.push({ label: "A lowercase letter", met: /[a-z]/.test(password) });
  if (policy.uppercase) rules.push({ label: "An uppercase letter", met: /[A-Z]/.test(password) });
  if (policy.number) rules.push({ label: "A number", met: /[0-9]/.test(password) });
  if (policy.symbol) rules.push({ label: "A symbol", met: /[^A-Za-z0-9]/.test(password) });
  return rules;
}

/** Why the password is not allowed, or null when it is. */
export function passwordProblem(password: string, policy: PasswordPolicy): string | null {
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Passwords can be up to ${MAX_PASSWORD_LENGTH} characters.`;
  const missing = passwordRules(password, policy).filter((rule) => !rule.met);
  if (missing.length === 0) return null;
  return `Password needs: ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`;
}

/** Strength from 0 (empty) to 4 (very strong), from length and character variety. */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password)
  ).length;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  score += Math.max(variety - 1, 0);
  if (/^(.)\1+$/.test(password)) score = 0;
  return Math.min(Math.max(score, 1), 4) as 1 | 2 | 3 | 4;
}

export const SCORE_LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;
