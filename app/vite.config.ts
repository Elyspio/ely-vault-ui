import path from "node:path";
import { convertPathToAlias, defaultFmtConfig, defaultLintConfig } from "@elyspio/vite-eslint-config";
import { defineConfig } from "vite-plus";
import tsconfigNode from "./tsconfig.node.json";
import tsconfigWeb from "./tsconfig.web.json";

// Build and dev still go through electron-vite (config/electron.vite.config.ts).
// This file only configures the vite-plus toolchain: fmt, lint and test.
const ignorePatterns = ["out/**", "resources/**", "build/**"];

export default defineConfig(({ mode }) => ({
	fmt: {
		...defaultFmtConfig,
		ignorePatterns: [...defaultFmtConfig.ignorePatterns, ...ignorePatterns],
	},
	lint: {
		...defaultLintConfig,
		ignorePatterns: [...defaultLintConfig.ignorePatterns, ...ignorePatterns],
	},
	resolve: {
		// Main and renderer aliases: unit tests cover both processes
		alias: convertPathToAlias({ ...tsconfigWeb.compilerOptions.paths, ...tsconfigNode.compilerOptions.paths }, path.resolve(import.meta.dirname)),
	},
	test: {
		environment: "node",
		// `pnpm test:live` (vp test --mode live) runs the opt-in integration tests against a local server
		include: mode === "live" ? ["scripts/**/*.live.ts"] : ["src/**/*.test.ts", "scripts/**/*.test.ts"],
		// Each live test spawns the Bitwarden CLI and talks to a real server: it is slow
		testTimeout: mode === "live" ? 120_000 : undefined,
		passWithNoTests: true,
	},
}));
