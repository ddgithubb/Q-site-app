import { configureStore } from '@reduxjs/toolkit'
import { poolReducer, PoolsState } from './slices/pool.slice';
import { profileReducer, ProfileState } from './slices/profile.slice';
import { settingReducer } from './slices/settings.slice';

export type GlobalState = {
    profile: ProfileState;
    pool: PoolsState;
}

export const store = configureStore({
    reducer: {
        profile: profileReducer,
        setting: settingReducer,
        pool: poolReducer,
    },
});

export function getStoreState(): GlobalState {
    return store.getState();
}