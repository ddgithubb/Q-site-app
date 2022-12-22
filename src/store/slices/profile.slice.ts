import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE } from "../../config/caching";
import { DeviceType, Pool, PoolDevice, PoolInfo, PoolMessagePackage } from "../../pool/pool.model";

export interface ProfileState {
    userID: string;
    device: PoolDevice;
}

const initialState: ProfileState = {
    userID: "TEST_USER_ID",
    device: {
        DeviceID: "DEVICE_ID",
        DeviceType: DeviceType.BROWSER,
        DeviceName: "Main device",
    }
}

const profileSlice = createSlice({
    name: "profile",
    initialState: initialState,
    reducers: {
        initProfile(state: ProfileState, action: PayloadAction<ProfileState>) {
            state.userID = action.payload.userID;
            state.device = action.payload.device;
        }
    }
});

export const profileReducer = profileSlice.reducer;
export const profileAction = profileSlice.actions;

