import { createAsyncActionGenerator, getServices } from "@store/utils/utils.actions";
import { ConfigService } from "@services/config.service";
import type { AppConfig } from "@shared/config/app.config";

const createAsyncThunk = createAsyncActionGenerator("config");

export const initConfig = createAsyncThunk("init", async (_, { extra }) => {
	const services = getServices({ config: ConfigService }, extra);
	return await services.config.get();
});

export const saveConfig = createAsyncThunk("save", async (config: AppConfig, { extra }) => {
	const services = getServices({ config: ConfigService }, extra);
	await services.config.set(config);
});
