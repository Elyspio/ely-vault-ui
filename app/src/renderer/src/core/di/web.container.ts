import { Container } from "inversify";

export const webContainer = new Container({ autobind: true, defaultScope: "Singleton" });
