import { createAsyncActionGenerator, getServices } from "@store/utils/utils.actions";
import { VaultService } from "@services/vault.service";
import { showToast } from "@modules/ui/ui.reducer";
import { ipcErrorMessage } from "@core/utils/ipc.utils";

const createAsyncThunk = createAsyncActionGenerator("vault");

export const loadVault = createAsyncThunk("load", async (_, { extra }) => {
	const services = getServices({ vault: VaultService }, extra);
	return await services.vault.snapshot();
});

export const syncVault = createAsyncThunk("sync", async (_, { extra, dispatch, rejectWithValue }) => {
	const services = getServices({ vault: VaultService }, extra);
	try {
		const snapshot = await services.vault.sync();
		dispatch(showToast("Vault synced"));
		return snapshot;
	} catch (error) {
		dispatch(showToast(`Sync failed: ${ipcErrorMessage(error)}`, "error"));
		return rejectWithValue(ipcErrorMessage(error));
	}
});
