import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE } from "../../config/caching";
import { DeviceType, PoolDeviceInfo } from "../../sstypes/sync_server.v1";

export interface ProfileState {
    userID: string;
    displayName: string;
    device: PoolDeviceInfo;
}

const initialState: ProfileState = {
    userID: "TEST_USER_ID",
    displayName: "TEST_DISPLAY_NAME",
    device: {
        deviceId: "DEVICE_ID",
        deviceType: DeviceType.BROWSER,
        deviceName: "Main device",
    }
}

const profileSlice = createSlice({
    name: "profile",
    initialState: initialState,
    reducers: {
        initProfile(state: ProfileState, action: PayloadAction<ProfileState>) {
            state.userID = action.payload.userID;
            state.displayName = action.payload.displayName;
            state.device = action.payload.device;
        },
        setDisplayName(state: ProfileState, action: PayloadAction<string>) {
            state.displayName = action.payload;
        }
    }
});

export const profileReducer = profileSlice.reducer;
export const profileAction = profileSlice.actions;

