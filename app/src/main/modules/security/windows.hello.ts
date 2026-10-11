import crypto from "node:crypto";
import koffi from "koffi";

/**
 * Windows Hello user consent (Windows.Security.Credentials.UI.UserConsentVerifier), called through WinRT with koffi.
 *
 * The verification dialog is attached to the application window (IUserConsentVerifierInterop), so it opens in front of it.
 */

export type HelloVerification = "verified" | "canceled" | "unavailable" | "busy" | "retries-exhausted";

/** UserConsentVerificationResult values */
const verificationResults: Record<number, HelloVerification> = {
	0: "verified",
	1: "unavailable",
	2: "unavailable",
	3: "unavailable",
	4: "busy",
	5: "retries-exhausted",
	6: "canceled",
};

const CLASS_NAME = "Windows.Security.Credentials.UI.UserConsentVerifier";
const IID_STATICS = "af4f3f91-564c-4ddc-b8b5-973447627c65";
const IID_INTEROP = "39e050c3-4e74-441a-8dc0-b81104df949c";
const IID_ASYNC_INFO = "00000036-0000-0000-c000-000000000046";
/** IAsyncOperation`1, instantiated below for the two result enums */
const PIID_ASYNC_OPERATION = "9fc2b0bb-e446-44e2-aa61-9cab8f636af2";
/** Namespace of the parameterized interface ids (WinRT type system) */
const WINRT_PINTERFACE_NAMESPACE = "11f47ad5-7b73-42c0-abae-878b1e16adee";

const ASYNC_STARTED = 0;
const ASYNC_COMPLETED = 1;
const POLL_MS = 50;

/** IInspectable methods come first in every WinRT interface */
const INSPECTABLE_METHODS = 6;

/**
 * Id of IAsyncOperation<enum>: UUID v5 (SHA-1) of the type signature in the WinRT namespace
 */
export function asyncOperationIid(enumName: string) {
	const signature = `pinterface({${PIID_ASYNC_OPERATION}};enum(${enumName};i4))`;
	const hash = crypto
		.createHash("sha1")
		.update(Buffer.from(WINRT_PINTERFACE_NAMESPACE.replaceAll("-", ""), "hex"))
		.update(signature, "utf8")
		.digest();
	hash[6] = (hash[6] & 0x0f) | 0x50;
	hash[8] = (hash[8] & 0x3f) | 0x80;
	const hex = hash.subarray(0, 16).toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** GUID in memory layout: the first three groups are little endian */
function guid(value: string) {
	const hex = value.replaceAll("-", "");
	const buffer = Buffer.from(hex, "hex");
	buffer.subarray(0, 4).reverse();
	buffer.subarray(4, 6).reverse();
	buffer.subarray(6, 8).reverse();
	return buffer;
}

type Pointer = unknown;

function loadWinRt() {
	const combase = koffi.load("combase.dll");
	const protos = {
		queryInterface: koffi.proto("long __stdcall QueryInterface(void *self, const uint8_t *riid, _Out_ void **out)"),
		release: koffi.proto("uint32_t __stdcall Release(void *self)"),
		checkAvailabilityAsync: koffi.proto("long __stdcall CheckAvailabilityAsync(void *self, _Out_ void **operation)"),
		requestVerificationForWindowAsync: koffi.proto(
			"long __stdcall RequestVerificationForWindowAsync(void *self, uintptr_t window, void *message, const uint8_t *riid, _Out_ void **operation)"
		),
		getStatus: koffi.proto("long __stdcall GetStatus(void *self, _Out_ int *status)"),
		getResults: koffi.proto("long __stdcall GetResults(void *self, _Out_ int *result)"),
		close: koffi.proto("long __stdcall Close(void *self)"),
	};

	return {
		protos,
		RoInitialize: combase.func("long __stdcall RoInitialize(int initType)"),
		RoGetActivationFactory: combase.func("long __stdcall RoGetActivationFactory(void *classId, const uint8_t *iid, _Out_ void **factory)"),
		WindowsCreateString: combase.func("long __stdcall WindowsCreateString(const char16_t *source, uint32_t length, _Out_ void **string)"),
		WindowsDeleteString: combase.func("long __stdcall WindowsDeleteString(void *string)"),
	};
}

let winRt: ReturnType<typeof loadWinRt> | undefined;

function api() {
	if (!winRt) {
		winRt = loadWinRt();
		// Multithreaded apartment; an already initialized thread (Electron's main thread) keeps its own
		winRt.RoInitialize(1);
	}
	return winRt;
}

function check(hresult: number, what: string) {
	if (hresult < 0) throw new Error(`${what} failed (0x${(hresult >>> 0).toString(16)})`);
}

/** Calls the method at `index` of a COM interface */
function invoke(object: Pointer, index: number, proto: ReturnType<typeof koffi.proto>, ...args: unknown[]): number {
	const table = koffi.decode(object, "void *");
	const method = koffi.decode(table, index * koffi.sizeof("void *"), "void *");
	return koffi.call(method, proto, object, ...args) as number;
}

function release(object: Pointer) {
	if (object) invoke(object, 2, api().protos.release);
}

function queryInterface(object: Pointer, iid: string) {
	const out: Pointer[] = [null];
	check(invoke(object, 0, api().protos.queryInterface, guid(iid), out), "QueryInterface");
	return out[0];
}

function activationFactory(iid: string) {
	const { WindowsCreateString, WindowsDeleteString, RoGetActivationFactory } = api();
	const name: Pointer[] = [null];
	check(WindowsCreateString(CLASS_NAME, CLASS_NAME.length, name), "WindowsCreateString");
	try {
		const factory: Pointer[] = [null];
		check(RoGetActivationFactory(name[0], guid(iid), factory), "RoGetActivationFactory");
		return factory[0];
	} finally {
		WindowsDeleteString(name[0]);
	}
}

/**
 * Waits for an IAsyncOperation of an enum and returns its value (the operation is released)
 */
async function awaitEnum(operation: Pointer): Promise<number> {
	const { protos } = api();
	const info = queryInterface(operation, IID_ASYNC_INFO);
	try {
		const status = [ASYNC_STARTED];
		for (;;) {
			check(invoke(info, INSPECTABLE_METHODS + 1, protos.getStatus, status), "IAsyncInfo.Status");
			if (status[0] !== ASYNC_STARTED) break;
			await new Promise((resolve) => setTimeout(resolve, POLL_MS));
		}
		if (status[0] !== ASYNC_COMPLETED) throw new Error("Windows Hello operation did not complete");

		const result = [0];
		check(invoke(operation, INSPECTABLE_METHODS + 2, protos.getResults, result), "IAsyncOperation.GetResults");
		return result[0];
	} finally {
		invoke(info, INSPECTABLE_METHODS + 4, protos.close);
		release(info);
		release(operation);
	}
}

/**
 * Whether Windows Hello (face, fingerprint or PIN) is set up for the user
 */
export async function isHelloAvailable(): Promise<boolean> {
	const statics = activationFactory(IID_STATICS);
	try {
		const operation: Pointer[] = [null];
		check(invoke(statics, INSPECTABLE_METHODS, api().protos.checkAvailabilityAsync, operation), "CheckAvailabilityAsync");
		// UserConsentVerifierAvailability.Available
		return (await awaitEnum(operation[0])) === 0;
	} finally {
		release(statics);
	}
}

/**
 * Asks the user to verify their identity with Windows Hello, in a dialog attached to the window `windowHandle` (HWND)
 */
export async function requestHelloVerification(windowHandle: bigint, message: string): Promise<HelloVerification> {
	const { WindowsCreateString, WindowsDeleteString, protos } = api();
	const interop = activationFactory(IID_INTEROP);
	const text: Pointer[] = [null];
	try {
		check(WindowsCreateString(message, message.length, text), "WindowsCreateString");
		const operation: Pointer[] = [null];
		const iid = guid(asyncOperationIid("Windows.Security.Credentials.UI.UserConsentVerificationResult"));
		check(invoke(interop, INSPECTABLE_METHODS, protos.requestVerificationForWindowAsync, windowHandle, text[0], iid, operation), "RequestVerificationForWindowAsync");
		return verificationResults[await awaitEnum(operation[0])] ?? "unavailable";
	} finally {
		if (text[0]) WindowsDeleteString(text[0]);
		release(interop);
	}
}
