import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { gibibytesToBytes, mebibytesToBytes } from "../../helpers/file-size";

export interface SettingState {
    storageSettings: StorageSettings;
}

export interface StorageSettings {
    maxFileCacheSize: number
    maxCacheChunkSize: number;
    maxMediaCacheSize: number;
    maxSendBufferSize: number;
}

const initialState: SettingState = {
    storageSettings: {
        maxFileCacheSize: mebibytesToBytes(512), // 512 MB in memory FOR BROWSERS THAT DO NOT HAVE FILE ACCESS API
        maxCacheChunkSize: gibibytesToBytes(1), // 1 GB in indexedDB / fs
        maxMediaCacheSize: mebibytesToBytes(256), // 256 MB in memory
        maxSendBufferSize: mebibytesToBytes(256),
    }
}

const settingSlice = createSlice({
    name: "setting",
    initialState: initialState,
    reducers: {
    }
});

export const settingReducer = settingSlice.reducer;
export const settingAction = settingSlice.actions;

