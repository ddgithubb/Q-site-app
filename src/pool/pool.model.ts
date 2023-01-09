import { PoolFileInfo, PoolMessage, PoolFileOffer } from "./pool.v1";
import { PoolUserInfo } from "./sync_server.v1";

export const NODE_ID_LENGTH = 10;
export const MESSAGE_ID_LENGTH = 21;
export const FILE_ID_LENGTH = 21;

export enum PoolConnectionState {
    CLOSED,
    CONNECTED,
    CONNECTING,
    RECONNECTING,
}

export enum PoolDownloadProgressStatus {
    DOWNLOADING,
    RETRYING,
    UNAVAILABLE,
}

export interface PoolInfo {
    poolID: string;
    poolName: string;
    users: PoolUserInfo[];
    key: number;
    settings: PoolSettings;
}

export interface Pool {
    poolID: string;
    poolName: string;
    users: PoolUserInfo[];
    poolSettings: PoolSettings;
    key: number;
    connectionState: PoolConnectionState;
    activeNodes: PoolNode[];
    downloadQueue: PoolFileOffer[];
    messages: PoolMessage[];
}

export interface PoolNode {
    nodeID: string;
    userID: string;
    deviceID: string;
    fileOffersInfo: PoolFileInfo[];
}

export interface PoolSettings {
    maxTextLength: number;
    maxMediaSize: number;
}