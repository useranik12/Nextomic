import { getDb, smtpAccounts } from "@nextomic/db";
import { decryptSecrets, encryptSecrets } from "@nextomic/integrations";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { platformKeyring } from "../keyring";

// SMTP accounts. Saved accounts live in the database with sealed passwords; the SMTP_* variables
// (set in Dokploy) appear as one read-only "environment" account. The default account sends
// platform email; with no saved default, the environment account is the default.

export const SMTP_ENV_ID = "env";

export type SmtpSecurity = "tls" | "starttls" | "none";

export interface SmtpAccountView {
  id: string;
  source: "env" | "saved";
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  hasPassword: boolean;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  rateLimitPerMinute: number | null;
  isDefault: boolean;
}

/** Everything needed to send with an account, password included. Server only. */
export interface ResolvedSmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  password: string | null;
  from: { name: string; address: string };
  replyTo: string | null;
  rateLimitPerMinute: number | null;
}

export class SmtpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmtpError";
  }
}

const noLineBreaks = (value: string) => !/[\r\n]/.test(value);
const HOST =
  /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

export const smtpAccountInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1, "Give the account a name.").max(80).refine(noLineBreaks),
  host: z.string().trim().regex(HOST, "Enter a host name such as smtp.example.com."),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(["tls", "starttls", "none"]),
  username: z.string().trim().max(320).refine(noLineBreaks).default(""),
  /** Blank keeps the saved password; null removes it. */
  password: z.string().max(1000).nullable().default(""),
  fromName: z
    .string()
    .trim()
    .min(1, "Enter a sender name.")
    .max(120)
    .refine(noLineBreaks, "No line breaks."),
  fromAddress: z.string().trim().email("Enter a valid sender address."),
  replyTo: z
    .union([z.literal(""), z.string().trim().email("Enter a valid reply-to address.")])
    .default(""),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(10_000).nullable().default(null)
});

export type SmtpAccountInput = z.input<typeof smtpAccountInputSchema>;

const envSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false", ""]).optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(3)
});

/** `Name <address>` or a bare address. */
export function parseMailbox(value: string): { name: string; address: string } {
  const match = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(value);
  if (match) return { name: (match[1] ?? "").trim(), address: (match[2] ?? "").trim() };
  return { name: "", address: value.trim() };
}

function envAccount(): ResolvedSmtpAccount | null {
  if (!process.env.SMTP_HOST) return null;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) return null;
  const env = parsed.data;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : env.SMTP_PORT === 465;
  return {
    id: SMTP_ENV_ID,
    name: "Environment (SMTP_* variables)",
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    security: secure ? "tls" : "starttls",
    username: env.SMTP_USERNAME || null,
    password: env.SMTP_PASSWORD || null,
    from: parseMailbox(env.SMTP_FROM),
    replyTo: null,
    rateLimitPerMinute: null
  };
}

type Row = typeof smtpAccounts.$inferSelect;

function rowPassword(row: Row): string | null {
  if (!row.passwordCiphertext || !row.passwordIv || !row.passwordTag || row.keyVersion === null)
    return null;
  const opened = decryptSecrets(
    {
      ciphertext: row.passwordCiphertext,
      iv: row.passwordIv,
      tag: row.passwordTag,
      keyVersion: row.keyVersion
    },
    `smtp:${row.id}`,
    platformKeyring()
  );
  return opened.password ?? null;
}

function resolveRow(row: Row): ResolvedSmtpAccount {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    security: row.security,
    username: row.username,
    password: rowPassword(row),
    from: { name: row.fromName, address: row.fromAddress },
    replyTo: row.replyTo,
    rateLimitPerMinute: row.rateLimitPerMinute
  };
}

const savedRows = () => getDb().select().from(smtpAccounts).orderBy(asc(smtpAccounts.createdAt));

export async function listSmtpAccounts(): Promise<SmtpAccountView[]> {
  const rows = await savedRows();
  const env = envAccount();
  const savedDefault = rows.some((r) => r.isDefault);
  const views: SmtpAccountView[] = rows.map((row) => ({
    id: row.id,
    source: "saved",
    name: row.name,
    host: row.host,
    port: row.port,
    security: row.security,
    username: row.username,
    hasPassword: row.passwordCiphertext !== null,
    fromName: row.fromName,
    fromAddress: row.fromAddress,
    replyTo: row.replyTo,
    rateLimitPerMinute: row.rateLimitPerMinute,
    isDefault: row.isDefault
  }));
  if (!env) return views;
  return [
    {
      id: env.id,
      source: "env",
      name: env.name,
      host: env.host,
      port: env.port,
      security: env.security,
      username: env.username,
      hasPassword: env.password !== null,
      fromName: env.from.name,
      fromAddress: env.from.address,
      replyTo: null,
      rateLimitPerMinute: null,
      isDefault: !savedDefault
    },
    ...views
  ];
}

/** The account to send with: the one asked for, else the default. Null when none is set up. */
export async function resolveSmtpAccount(id: string | null): Promise<ResolvedSmtpAccount | null> {
  if (id === SMTP_ENV_ID) return envAccount();
  const db = getDb();
  if (id) {
    const [row] = await db.select().from(smtpAccounts).where(eq(smtpAccounts.id, id)).limit(1);
    return row ? resolveRow(row) : null;
  }
  const [def] = await db
    .select()
    .from(smtpAccounts)
    .where(eq(smtpAccounts.isDefault, true))
    .limit(1);
  return def ? resolveRow(def) : envAccount();
}

/** Whether any account can send platform email right now. */
export async function hasSmtpAccount(): Promise<boolean> {
  return (await resolveSmtpAccount(null)) !== null;
}

const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export async function saveSmtpAccount(raw: SmtpAccountInput, userId: string): Promise<string> {
  const input = smtpAccountInputSchema.parse(raw);
  if (input.id === SMTP_ENV_ID)
    throw new SmtpError("The environment account is set with the SMTP_* variables in Dokploy.");
  const db = getDb();
  const [existing] = input.id
    ? await db.select().from(smtpAccounts).where(eq(smtpAccounts.id, input.id)).limit(1)
    : [];
  if (input.id && !existing) throw new SmtpError("SMTP account not found.");
  const id = existing?.id ?? crypto.randomUUID();
  const password =
    input.password === null
      ? null
      : input.password !== ""
        ? input.password
        : existing
          ? rowPassword(existing)
          : null;
  const sealed = password ? encryptSecrets({ password }, `smtp:${id}`, platformKeyring()) : null;
  const values = {
    name: input.name,
    host: input.host,
    port: input.port,
    security: input.security,
    username: input.username || null,
    passwordCiphertext: sealed?.ciphertext ?? null,
    passwordIv: sealed?.iv ?? null,
    passwordTag: sealed?.tag ?? null,
    keyVersion: sealed?.keyVersion ?? null,
    fromName: input.fromName,
    fromAddress: input.fromAddress,
    replyTo: input.replyTo || null,
    rateLimitPerMinute: input.rateLimitPerMinute,
    updatedAt: new Date()
  };
  try {
    if (existing) await db.update(smtpAccounts).set(values).where(eq(smtpAccounts.id, id));
    else await db.insert(smtpAccounts).values({ id, createdBy: userId, ...values });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new SmtpError("Another SMTP account already has this name.");
    throw error;
  }
  return id;
}

export async function deleteSmtpAccount(id: string): Promise<void> {
  if (id === SMTP_ENV_ID)
    throw new SmtpError("Remove the SMTP_* variables in Dokploy to remove this account.");
  await getDb().delete(smtpAccounts).where(eq(smtpAccounts.id, id));
}

/** Makes `id` the default. Choosing the environment account clears any saved default. */
export async function setDefaultSmtpAccount(id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    if (id !== SMTP_ENV_ID) {
      const [row] = await tx
        .select({ id: smtpAccounts.id })
        .from(smtpAccounts)
        .where(eq(smtpAccounts.id, id))
        .limit(1);
      if (!row) throw new SmtpError("SMTP account not found.");
    } else if (!envAccount()) throw new SmtpError("No SMTP_* variables are set.");
    await tx.update(smtpAccounts).set({ isDefault: false }).where(eq(smtpAccounts.isDefault, true));
    if (id !== SMTP_ENV_ID)
      await tx.update(smtpAccounts).set({ isDefault: true }).where(eq(smtpAccounts.id, id));
  });
}
