import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const NATIVE_POPUP_PATTERN =
  /window\.alert|window\.confirm|window\.prompt|\balert\(|\bconfirm\(|\bprompt\(/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("native popup guard", () => {
  it("does not allow browser alert, confirm, or prompt calls in frontend source", () => {
    const violations = sourceFiles(join(process.cwd(), "src"))
      .filter((path) => !path.endsWith("native-popup-guard.test.ts"))
      .filter((path) => NATIVE_POPUP_PATTERN.test(readFileSync(path, "utf8")));

    expect(violations).toEqual([]);
  });
});
