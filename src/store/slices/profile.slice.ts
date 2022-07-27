import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE } from "../../config/caching";
import { Pool, PoolInfo, PoolMessage } from "../../pool/pool.model";

export enum DeviceType {
    COMPUTER,
    MOBILE,
}

export interface ProfileState {
    userID: string;
    deviceType: DeviceType;
    deviceName: string;
}

const initialState: ProfileState = {
    userID: "",
    deviceType: DeviceType.COMPUTER,
    deviceName: "Main device",
}

const profileSlice = createSlice({
    name: "profile",
    initialState: initialState,
    reducers: {
        initProfile(state: ProfileState, action: PayloadAction<ProfileState>) {
            state = action.payload;
        }
    }
});

export const profileReducer = profileSlice.reducer;
export const profileAction = profileSlice.actions;

