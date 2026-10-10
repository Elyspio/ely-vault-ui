import { Container } from "inversify";

export const mainContainer = new Container({ defaultScope: "Singleton", autobind: true });
