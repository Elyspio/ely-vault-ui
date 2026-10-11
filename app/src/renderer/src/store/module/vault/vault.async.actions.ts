import { createAsyncActionGenerator, getServices } from "@store/utils/utils.actions";
import { VaultService } from "@services/vault.service";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage } from "@core/utils/ipc.utils";
import { i18n } from "@/config/i18n";

const createAsyncThunk = createAsyncActionGenerator("vault");

export const loadVault = createAsyncThunk("load", async (_, { extra }) => {
	const services = getServices({ vault: VaultService }, extra);
	return await services.vault.snapshot();
});

export const syncVault = createAsyncThunk("sync", async (_, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ vault: VaultService }, extra);
	try {
		const snapshot = await services.vault.sync();
		dispatch(showToast(i18n.t("actions:sync.synced")));
		return snapshot;
	} catch (error) {
		dispatch(showToast(i18n.t("actions:sync.failed", { error: ipcErrorMessage(error) }), "error"));
		return rejectWithValue(ipcErrorMessage(error));
	}
});
