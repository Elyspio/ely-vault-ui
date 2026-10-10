import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { convertPathToAlias } from "@elyspio/vite-eslint-config";
import tsconfigNode from "../tsconfig.node.json";
import tsconfigWeb from "../tsconfig.web.json";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Content Security Policy of the renderer. The dev server needs inline scripts (React refresh preamble) and its websocket.
 */
function contentSecurityPolicy(): Plugin {
	const strict =
		"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";
	const dev =
		"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws:; base-uri 'none'; form-action 'none'";
	let isDev = false;
	return {
		name: "content-security-policy",
		configResolved(config) {
			isDev = config.command === "serve";
		},
		transformIndexHtml(html) {
			return html.replace("%CONTENT_SECURITY_POLICY%", isDev ? dev : strict);
		},
	};
}

const basePath = path.join(__dirname, "..");

const nodeAlias = convertPathToAlias(tsconfigNode.compilerOptions.paths, basePath);
const rendererAlias = convertPathToAlias(tsconfigWeb.compilerOptions.paths, basePath);

export default defineConfig({
	main: {
		resolve: {
			alias: nodeAlias,
		},
	},
	preload: {
		resolve: {
			alias: nodeAlias,
		},
	},
	renderer: {
		resolve: {
			alias: rendererAlias,
		},
		plugins: [react(), contentSecurityPolicy()],
	},
});
