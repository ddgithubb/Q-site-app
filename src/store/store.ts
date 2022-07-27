import { configureStore } from '@reduxjs/toolkit'
import { poolReducer, PoolsState } from './slices/pool.slice';
import { profileReducer, ProfileState } from './slices/profile.slice';

export type GlobalState = {
    profile: ProfileState;
    pool: PoolsState;
}

export const store = configureStore({
    reducer: {
        profile: profileReducer,
        pool: poolReducer,
    },
});

export function getStoreState(): GlobalState {
    return store.getState();
}