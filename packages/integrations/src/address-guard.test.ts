import { describe, expect, it } from "vitest";
import { classifyAddress, isAddressAllowed } from "./address-guard";

describe("address guard", () => {
  it.each([
    ["8.8.8.8", "public"],
    ["104.16.0.1", "public"],
    ["2606:4700::1111", "public"],
    ["10.1.2.3", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["172.32.0.1", "public"],
    ["192.168.1.1", "private"],
    ["127.0.0.1", "private"],
    ["100.64.0.1", "private"],
    ["::1", "private"],
    ["fc00::1", "private"],
    ["fd12:3456::1", "private"],
    ["169.254.169.254", "forbidden"],
    ["100.100.100.200", "forbidden"],
    ["0.0.0.0", "forbidden"],
    ["224.0.0.1", "forbidden"],
    ["255.255.255.255", "forbidden"],
    ["::", "forbidden"],
    ["fe80::1", "forbidden"],
    ["ff02::1", "forbidden"],
    ["fd00:ec2::254", "forbidden"],
    ["::ffff:127.0.0.1", "private"],
    ["::ffff:7f00:1", "private"],
    ["::ffff:169.254.169.254", "forbidden"],
    ["::ffff:8.8.8.8", "public"],
    ["64:ff9b::a9fe:a9fe", "forbidden"],
    ["2002:a9fe:a9fe::1", "forbidden"],
    ["2002:0a00:0001::1", "private"],
    ["fe80::1%eth0", "forbidden"],
    ["not-an-ip", "forbidden"],
    ["999.1.1.1", "forbidden"]
  ])("%s is %s", (ip, verdict) => {
    expect(classifyAddress(ip)).toBe(verdict);
  });

  it("lets private addresses through only when allowed, and metadata never", () => {
    expect(isAddressAllowed("10.0.0.1", false)).toBe(false);
    expect(isAddressAllowed("10.0.0.1", true)).toBe(true);
    expect(isAddressAllowed("127.0.0.1", true)).toBe(true);
    expect(isAddressAllowed("169.254.169.254", true)).toBe(false);
    expect(isAddressAllowed("8.8.8.8", false)).toBe(true);
  });
});
