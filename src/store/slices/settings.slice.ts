import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { gibibytesToBytes, mebibytesToBytes } from "../../helpers/file-size";

export interface SettingState {
    storageSettings: StorageSettings;
}

export interface StorageSettings {
    maxFileCacheSize: number
    maxCacheChunkSize: number;
    maxMediaCacheSize: number;
}

const initialState: SettingState = {
    storageSettings: {
        maxFileCacheSize: mebibytesToBytes(512), // 512 MB in memory FOR BROWSERS THAT DO NOT HAVE FILE ACCESS API
        maxCacheChunkSize: gibibytesToBytes(1), // 1 GB in indexedDB / fs
        maxMediaCacheSize: mebibytesToBytes(512), // 512 MB in indexedDB / fs
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

