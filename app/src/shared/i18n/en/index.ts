import { actions } from "./actions";
import { auth } from "./auth";
import { common } from "./common";
import { editor } from "./editor";
import { main } from "./main";
import { messages } from "./messages";
import { settings } from "./settings";
import { vault } from "./vault";

/** English texts, source of every translation; one namespace per area of the interface */
export const en = { common, messages, main, auth, settings, editor, vault, actions };
