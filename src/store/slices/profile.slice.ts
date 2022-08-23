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
    userID: "TEST_USER_ID",
    deviceType: DeviceType.COMPUTER,
    deviceName: "Main device",
}

const profileSlice = createSlice({
    name: "profile",
    initialState: initialState,
    reducers: {
        initProfile(state: ProfileState, action: PayloadAction<ProfileState>) {
            state.userID = action.payload.userID;
            state.deviceType = action.payload.deviceType;
            state.deviceName = action.payload.deviceName;
        }
    }
});

export const profileReducer = profileSlice.reducer;
export const profileAction = profileSlice.actions;

