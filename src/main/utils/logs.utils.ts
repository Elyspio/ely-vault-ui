import type { AppLoggerService } from "../modules/log.module";

interface ILoggable {
	logger: AppLoggerService;
}

/**
 * Décorateur qui logge l'entrée, la sortie et la durée d'une méthode.
 *
 * Volontairement sans les paramètres ni la valeur de retour : ils peuvent contenir des secrets.
 */
export function log(level: "debug" | "info" = "debug") {
	return (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		const targetFunc = descriptor.value as (...args: unknown[]) => unknown;
		descriptor.value = function (this: ILoggable, ...args: unknown[]) {
			const logger = this.logger;
			const startAt = performance.now();
			const exit = (failed: boolean) => logger[failed ? "warn" : level](`Exit ${propertyKey}${failed ? " (failed)" : ""} (${(performance.now() - startAt).toFixed(1)}ms)`);

			logger[level](`Enter ${propertyKey}`);

			try {
				const result = targetFunc.apply(this, args);
				if (result instanceof Promise) {
					return result.then(
						(value: unknown) => {
							exit(false);
							return value;
						},
						(error: unknown) => {
							exit(true);
							throw error;
						}
					);
				}
				exit(false);
				return result;
			} catch (error) {
				exit(true);
				throw error;
			}
		};
		return descriptor;
	};
}
