import { describe, expect, it } from "vite-plus/test";
import { channelOfVersion, clampPanelLayout, readUpdateSettings } from "./app.config";

describe("channelOfVersion", () => {
	it("follows the prerelease of the installed version", () => {
		expect(channelOfVersion("1.2.0")).toBe("stable");
		expect(channelOfVersion("1.2.0-beta.3")).toBe("beta");
		expect(channelOfVersion("1.2.0-dev.7")).toBe("dev");
		expect(channelOfVersion("1.2.0-rc.1")).toBe("stable");
	});
});

describe("readUpdateSettings", () => {
	it("uses the channel of the installed version without saved settings", () => {
		expect(readUpdateSettings(undefined, "1.2.0")).toEqual({ autoCheck: true, channel: "stable" });
		expect(readUpdateSettings(undefined, "1.2.0-dev.2")).toEqual({ autoCheck: true, channel: "dev" });
		expect(readUpdateSettings({ autoCheck: false }, "1.2.0-beta.1")).toEqual({ autoCheck: false, channel: "beta" });
	});

	it("migrates the beta switch to the channel", () => {
		expect(readUpdateSettings({ autoCheck: false, beta: true }, "1.2.0")).toEqual({ autoCheck: false, channel: "beta" });
		expect(readUpdateSettings({ beta: false }, "1.2.0-dev.2")).toEqual({ autoCheck: true, channel: "stable" });
	});

	it("keeps a saved channel", () => {
		expect(readUpdateSettings({ autoCheck: true, channel: "dev" }, "1.2.0")).toEqual({ autoCheck: true, channel: "dev" });
		expect(readUpdateSettings({ channel: "stable", beta: true }, "1.2.0-dev.2")).toEqual({ autoCheck: true, channel: "stable" });
	});
});

describe("clampPanelLayout", () => {
	it("keeps the widths within their limits", () => {
		expect(clampPanelLayout({ sidebarWidth: 50, listWidth: 2000 })).toEqual({ sidebarWidth: 200, listWidth: 640 });
		expect(clampPanelLayout({ sidebarWidth: 300.4, listWidth: 400.6 })).toEqual({ sidebarWidth: 300, listWidth: 401 });
	});

	it("leaves room for the item detail, the other panel giving way first", () => {
		expect(clampPanelLayout({ sidebarWidth: 400, listWidth: 600 }, "listWidth", 1200)).toEqual({ sidebarWidth: 240, listWidth: 600 });
		expect(clampPanelLayout({ sidebarWidth: 400, listWidth: 600 }, "sidebarWidth", 1200)).toEqual({ sidebarWidth: 400, listWidth: 440 });
	});

	it("keeps the minimum widths when the screen is too narrow", () => {
		expect(clampPanelLayout({ sidebarWidth: 300, listWidth: 400 }, "listWidth", 700)).toEqual({ sidebarWidth: 200, listWidth: 280 });
	});
});
