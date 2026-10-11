import { describe, expect, it } from "vite-plus/test";
import { asyncOperationIid } from "./windows.hello";

describe("asyncOperationIid", () => {
	it("computes the WinRT id of IAsyncOperation<UserConsentVerificationResult>", () => {
		expect(asyncOperationIid("Windows.Security.Credentials.UI.UserConsentVerificationResult")).toBe("fd596ffd-2318-558f-9dbe-d21df43764a5");
	});
});
