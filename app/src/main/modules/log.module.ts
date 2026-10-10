import path from "node:path";
import * as fs from "node:fs";
import * as util from "node:util";
import * as winston from "winston";
import { MainContextModule } from "./context/main.context.module";
import { mainContainer } from "@main/di/container.di";

export type AppLoggerService = {
	info: (...args: unknown[]) => void;
	debug: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
};

/**
 * Base class of the modules, providing their logger.
 *
 * No secret (password, session key, item value) may go through a logger.
 */
export class LogModule {
	private static logFolder: string;
	private static root: winston.Logger | undefined;
	public logger: AppLoggerService;

	protected constructor(name: string) {
		this.logger = LogModule.create(name);
	}

	public static create(name: string): AppLoggerService {
		const root = LogModule.getRoot();
		const write =
			(level: string) =>
			(...args: unknown[]) => {
				root.log(level, args.map((arg) => (typeof arg === "string" ? arg : util.inspect(arg, false, 4))).join(" "), { module: name });
			};

		return {
			info: write("info"),
			debug: write("debug"),
			warn: write("warn"),
			error: write("error"),
		};
	}

	private static getRoot() {
		if (LogModule.root) return LogModule.root;

		const format = (colors: boolean) =>
			winston.format.combine(
				winston.format.timestamp(),
				...(colors ? [winston.format.colorize()] : []),
				winston.format.printf(({ timestamp, level, message, module }) => `${String(timestamp)} ${level} [${String(module)}] ${String(message)}`)
			);

		LogModule.root = winston.createLogger({
			level: "debug",
			transports: [
				new winston.transports.Console({ format: format(true) }),
				new winston.transports.File({
					filename: path.join(LogModule.getLogFolder(), "main.log"),
					maxsize: 5 * 1024 * 1024,
					maxFiles: 3,
					format: format(false),
				}),
			],
			exitOnError: false,
		});

		return LogModule.root;
	}

	private static getLogFolder() {
		if (LogModule.logFolder) return LogModule.logFolder;
		const folder = path.join(mainContainer.get(MainContextModule).appFolder, "logs");
		if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
		LogModule.logFolder = folder;
		return folder;
	}
}
