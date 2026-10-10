import type { PreloadExposed } from "./index";

declare global {
	interface Window {
		preload: PreloadExposed;
	}
}
