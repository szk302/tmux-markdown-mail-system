import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { loadConfig, findConfig } from "../../../src/config/loader.js";
import { ConfigNotFoundError } from "../../../src/shared/errors.js";
import { ConfigValidationError } from "../../../src/config/schema.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "tmms-config-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("loads valid config", async () => {
    const configPath = join(tmpDir, "config.yml");
    await writeFile(configPath, "polling_interval: 30\ndead_letter_dir: /tmp/dead\n");
    const config = await loadConfig(configPath);
    expect(config.polling_interval).toBe(30);
    expect(config.dead_letter_dir).toBe("/tmp/dead");
  });

  it("uses default polling_interval when not specified", async () => {
    const configPath = join(tmpDir, "config.yml");
    await writeFile(configPath, "dead_letter_dir: /tmp/dead\n");
    const config = await loadConfig(configPath);
    expect(config.polling_interval).toBe(60);
  });

  it("throws ConfigNotFoundError when file does not exist", async () => {
    await expect(loadConfig("/nonexistent/path/config.yml")).rejects.toThrow(ConfigNotFoundError);
  });

  it("throws ConfigValidationError when dead_letter_dir is missing", async () => {
    const configPath = join(tmpDir, "config.yml");
    await writeFile(configPath, "polling_interval: 10\n");
    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it("throws ConfigValidationError when polling_interval is negative", async () => {
    const configPath = join(tmpDir, "config.yml");
    await writeFile(configPath, "polling_interval: -1\ndead_letter_dir: /tmp/dead\n");
    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it("throws ConfigValidationError when polling_interval is not a number", async () => {
    const configPath = join(tmpDir, "config.yml");
    await writeFile(configPath, "polling_interval: fast\ndead_letter_dir: /tmp/dead\n");
    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });
});

describe("findConfig", () => {
  it("returns undefined when none of the lookup paths exist", async () => {
    const paths = [
      join(tmpDir, "nonexistent1.yml"),
      join(tmpDir, "nonexistent2.yml"),
    ];
    const result = await findConfig(paths);
    expect(result).toBeUndefined();
  });

  it("returns the first existing path", async () => {
    const path1 = join(tmpDir, "first.yml");
    const path2 = join(tmpDir, "second.yml");
    await writeFile(path1, "dead_letter_dir: /tmp/dead\n");
    await writeFile(path2, "dead_letter_dir: /tmp/dead\n");

    const result = await findConfig([path1, path2]);
    expect(result).toBe(path1);
  });

  it("skips missing paths and returns the first existing one", async () => {
    const path1 = join(tmpDir, "missing.yml");
    const path2 = join(tmpDir, "exists.yml");
    await writeFile(path2, "dead_letter_dir: /tmp/dead\n");

    const result = await findConfig([path1, path2]);
    expect(result).toBe(path2);
  });

  it("returns the only existing path", async () => {
    const path1 = join(tmpDir, "config.yml");
    await writeFile(path1, "dead_letter_dir: /tmp/dead\n");

    const result = await findConfig([path1]);
    expect(result).toBe(path1);
  });
});
