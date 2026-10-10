import { type AsyncThunkPayloadCreator, createAction as _createAction, createAsyncThunk as _createAsyncThunk } from "@reduxjs/toolkit";
import type { AppDispatch, ExtraArgument, StoreState } from "@store";

type Constructor<T> = new (...args: any[]) => T;

type InstanceTypes<T> = {
	[K in keyof T]: T[K] extends Constructor<infer I> ? I : never;
};

export function getServices<T extends Record<string, Constructor<unknown>>>(services: T, extra: ExtraArgument): InstanceTypes<T> {
	return Object.fromEntries(Object.entries(services).map(([key, service]) => [key, extra.container.get(service)])) as InstanceTypes<T>;
}

type ThunkParam = { extra: ExtraArgument; state: StoreState; dispatch: AppDispatch };

export function createAsyncActionGenerator(prefix: string) {
	return <Ret, Arg = void>(suffix: string, payloadCreator: AsyncThunkPayloadCreator<Ret, Arg, ThunkParam>) =>
		_createAsyncThunk<Ret, Arg, ThunkParam>(`${prefix}/${suffix}`, payloadCreator);
}

export function createActionGenerator(prefix: string) {
	return <Arg = void>(suffix: string) => _createAction<Arg>(`${prefix}/${suffix}`);
}
