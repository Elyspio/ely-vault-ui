import { describe, expect, it } from "vite-plus/test";
import { channelOfVersion, readUpdateSettings } from "./app.config";

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
