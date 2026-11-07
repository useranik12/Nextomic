import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseMailbox, smtpFromEnv, type SmtpAccount } from "./accounts";
import { retryDelay } from "./queue";
import { DEFAULT_TEMPLATES, renderTemplate } from "./templates";
import { smtpErrorMessage, smtpTransport } from "./transport";

// A minimal SMTP server: enough of the protocol for nodemailer to deliver one message.
let server: Server;
let port = 0;
const received: { from: string; to: string[]; data: string; auth: string | null }[] = [];

function session(socket: Socket) {
  let mail = { from: "", to: [] as string[], data: "", auth: null as string | null };
  let inData = false;
  let buffer = "";
  const reply = (line: string) => socket.write(`${line}\r\n`);
  reply("220 test ESMTP");
  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let at: number;
    while ((at = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      if (inData) {
        if (line === ".") {
          inData = false;
          received.push(mail);
          mail = { from: "", to: [], data: "", auth: mail.auth };
          reply("250 queued");
        } else mail.data += `${line}\n`;
        continue;
      }
      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO") reply("250-test\r\n250 AUTH PLAIN");
      else if (verb === "AUTH") {
        mail.auth = Buffer.from(line.split(" ")[2] ?? "", "base64")
          .toString("utf8")
          .split("\0")
          .slice(1)
          .join(":");
        reply(mail.auth === "user:pass" ? "235 ok" : "535 bad credentials");
      } else if (verb === "MAIL") {
        mail.from = line;
        reply("250 ok");
      } else if (verb === "RCPT") {
        mail.to.push(line);
        reply("250 ok");
      } else if (verb === "DATA") {
        inData = true;
        reply("354 go");
      } else if (verb === "QUIT") {
        reply("221 bye");
        socket.end();
      } else reply("250 ok");
    }
  });
}

beforeAll(async () => {
  server = createServer(session);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const account = (over: Partial<SmtpAccount> = {}): SmtpAccount => ({
  host: "127.0.0.1",
  port,
  security: "starttls",
  username: "user",
  password: "pass",
  from: { name: "Nextomic", address: "no-reply@example.com" },
  ...over
});

describe("smtp transport", () => {
  it("delivers a message with auth and the sender name", async () => {
    const rendered = renderTemplate(DEFAULT_TEMPLATES["reset-password"], {
      appName: "Nextomic",
      name: "Ana <b>",
      url: "https://app.example/reset?token=x"
    });
    await smtpTransport(account()).sendMail({
      from: account().from,
      to: "ana@example.com",
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html
    });
    const last = received.at(-1);
    expect(last?.auth).toBe("user:pass");
    expect(last?.to.join()).toContain("ana@example.com");
    expect(last?.data).toContain("From: Nextomic <no-reply@example.com>");
    expect(last?.data).toContain("Subject: Reset your Nextomic password");
  });

  it("explains a rejected login", async () => {
    const error = await smtpTransport(account({ password: "wrong" }))
      .verify()
      .catch((e: unknown) => e);
    expect(smtpErrorMessage(error)).toBe("The SMTP server rejected the username or password.");
  });
});

describe("templates", () => {
  it("escapes values in HTML, keeps them in text, strips line breaks from the subject", () => {
    const out = renderTemplate(
      { subject: "Hi {{ name }}", html: "<p>{{name}} {{missing}}</p>", text: "{{name}}" },
      { name: "A <b>\r\nB" }
    );
    expect(out.subject).toBe("Hi A <b> B");
    expect(out.html).toBe("<p>A &lt;b&gt;\r\nB </p>");
    expect(out.text).toBe("A <b>\r\nB");
  });

  it("every default template uses only its documented variables", () => {
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      const used = [
        ...`${template.subject}${template.html}${template.text}`.matchAll(/\{\{(\w+)\}\}/g)
      ].map((m) => m[1]);
      for (const name of used)
        expect(["name", "email", "url", "appName", "accountName"]).toContain(name);
    }
  });
});

describe("account input and helpers", () => {
  it("parses mailboxes", () => {
    expect(parseMailbox("Nextomic <no-reply@x.com>")).toEqual({
      name: "Nextomic",
      address: "no-reply@x.com"
    });
    expect(parseMailbox('"Team" <t@x.com>')).toEqual({ name: "Team", address: "t@x.com" });
    expect(parseMailbox("a@x.com")).toEqual({ name: "", address: "a@x.com" });
  });

  it("reads SMTP from the environment", () => {
    expect(smtpFromEnv({})).toBeNull();
    expect(
      smtpFromEnv({ SMTP_HOST: "smtp.x.com", SMTP_PORT: "465", SMTP_FROM: "Nextomic <n@x.com>" })
    ).toMatchObject({ port: 465, security: "tls", from: { name: "Nextomic", address: "n@x.com" } });
    expect(
      smtpFromEnv({
        SMTP_HOST: "smtp.x.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "",
        SMTP_FROM: "n@x.com"
      })
    ).toMatchObject({ security: "starttls", username: null });
    expect(() => smtpFromEnv({ SMTP_HOST: "smtp.x.com", SMTP_FROM: "" })).toThrow(/SMTP_FROM/);
  });

  it("waits longer after each failed attempt", () => {
    expect([1, 2, 3, 4].map(retryDelay)).toEqual([30_000, 120_000, 600_000, 1_800_000]);
  });
});
