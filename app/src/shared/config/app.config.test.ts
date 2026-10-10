import { describe, expect, it } from "vite-plus/test";
import { readUpdateSettings } from "./app.config";

describe("readUpdateSettings", () => {
	it("uses the defaults without saved settings", () => {
		expect(readUpdateSettings(undefined)).toEqual({ autoCheck: true, channel: "stable" });
	});

	it("migrates the beta switch to the channel", () => {
		expect(readUpdateSettings({ autoCheck: false, beta: true })).toEqual({ autoCheck: false, channel: "beta" });
		expect(readUpdateSettings({ beta: false })).toEqual({ autoCheck: true, channel: "stable" });
	});

	it("keeps a saved channel", () => {
		expect(readUpdateSettings({ autoCheck: true, channel: "dev" })).toEqual({ autoCheck: true, channel: "dev" });
		expect(readUpdateSettings({ channel: "dev", beta: true })).toEqual({ autoCheck: true, channel: "dev" });
	});
});
