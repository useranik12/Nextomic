import { isIP } from "node:net";

// Decides which resolved addresses a connector may reach. Public internet addresses pass.
// Private, loopback and shared ranges pass only when private hosts are allowed (development).
// Link-local, cloud metadata, multicast and reserved ranges never pass.

export type AddressVerdict = "public" | "private" | "forbidden";

type Range4 = readonly [base: number, bits: number, verdict: Exclude<AddressVerdict, "public">];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

const RANGES_V4: Range4[] = (
  [
    ["0.0.0.0", 8, "forbidden"],
    ["10.0.0.0", 8, "private"],
    ["100.100.100.200", 32, "forbidden"], // Alibaba Cloud metadata
    ["100.64.0.0", 10, "private"], // carrier-grade NAT
    ["127.0.0.0", 8, "private"],
    ["169.254.0.0", 16, "forbidden"], // link-local, AWS/GCP/Azure metadata
    ["172.16.0.0", 12, "private"],
    ["192.0.0.0", 24, "forbidden"],
    ["192.0.2.0", 24, "forbidden"],
    ["192.88.99.0", 24, "forbidden"],
    ["192.168.0.0", 16, "private"],
    ["198.18.0.0", 15, "forbidden"],
    ["198.51.100.0", 24, "forbidden"],
    ["203.0.113.0", 24, "forbidden"],
    ["224.0.0.0", 4, "forbidden"],
    ["240.0.0.0", 4, "forbidden"]
  ] as const
).map(([ip, bits, verdict]) => [v4ToInt(ip), bits, verdict] as const);

function classifyV4(ip: string): AddressVerdict {
  const value = v4ToInt(ip);
  for (const [base, bits, verdict] of RANGES_V4) {
    const size = 2 ** (32 - bits);
    if (value >= base && value < base + size) return verdict;
  }
  return "public";
}

/** The eight 16-bit groups of an IPv6 address (handles `::` and a trailing dotted IPv4). */
function v6Groups(ip: string): number[] {
  let text = ip.toLowerCase().split("%")[0] ?? "";
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1]) {
    const v4 = v4ToInt(dotted[1]);
    text = `${text.slice(0, -dotted[1].length)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill =
    tail === undefined ? [] : new Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right].map((g) => parseInt(g, 16));
}

const v4FromGroups = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

function classifyV6(ip: string): AddressVerdict {
  const g = v6Groups(ip);
  const [a = 0, b = 0] = g;
  const zeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeroUntil(8)) return "forbidden"; // ::
  if (zeroUntil(7) && g[7] === 1) return "private"; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) carry an IPv4 address.
  if (zeroUntil(5) && (g[5] === 0xffff || g[5] === 0))
    return classifyV4(v4FromGroups(g[6] ?? 0, g[7] ?? 0));
  // NAT64 (64:ff9b::/96) and 6to4 (2002::/16) embed an IPv4 address too.
  if (a === 0x64 && b === 0xff9b && g.slice(2, 6).every((x) => x === 0))
    return classifyV4(v4FromGroups(g[6] ?? 0, g[7] ?? 0));
  if (a === 0x2002) return classifyV4(v4FromGroups(b, g[2] ?? 0));
  if (a === 0xfd00 && b === 0x0ec2 && g[7] === 0x254) return "forbidden"; // AWS metadata over IPv6
  if ((a & 0xfe00) === 0xfc00) return "private"; // unique local fc00::/7
  if ((a & 0xffc0) === 0xfe80) return "forbidden"; // link-local
  if ((a & 0xff00) === 0xff00) return "forbidden"; // multicast
  if (a === 0x2001 && b === 0x0db8) return "forbidden"; // documentation
  if (a === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return "forbidden"; // discard
  return "public";
}

/** Classifies an IP address. Anything that is not a valid IP is forbidden. */
export function classifyAddress(ip: string): AddressVerdict {
  const family = isIP(ip.split("%")[0] ?? "");
  if (family === 4) return classifyV4(ip);
  if (family === 6) return classifyV6(ip);
  return "forbidden";
}

/** Whether a connector may connect to this address. */
export function isAddressAllowed(ip: string, allowPrivateHosts: boolean): boolean {
  const verdict = classifyAddress(ip);
  return verdict === "public" || (verdict === "private" && allowPrivateHosts);
}
