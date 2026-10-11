/**
 * Shape of a French translation: the same keys as the English source, any text.
 * Plurals (`key_one` / `key_other`) also need `key_many`, the French form of large numbers (1 000 000):
 * without it, i18next falls back to the English text.
 */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Translation<T[K]> } & {
	[K in keyof T as K extends `${infer Base}_other` ? `${Base}_many` : never]: string;
};
