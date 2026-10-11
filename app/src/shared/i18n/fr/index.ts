import type { en } from "../en";
import type { Translation } from "../i18n.types";
import { actions } from "./actions";
import { auth } from "./auth";
import { common } from "./common";
import { editor } from "./editor";
import { main } from "./main";
import { messages } from "./messages";
import { settings } from "./settings";
import { vault } from "./vault";

export const fr: Translation<typeof en> = { common, messages, main, auth, settings, editor, vault, actions };
