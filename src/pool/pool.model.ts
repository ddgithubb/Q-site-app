import { PoolMessage } from "./pool.v1";
import { DeviceType, PoolUserInfo } from "./sync_server.v1";

export const NODE_ID_LENGTH = 10;
export const MESSAGE_ID_LENGTH = 21;
export const FILE_ID_LENGTH = 21;

// export enum PoolMessageType {
//     NODE_STATE,
//     GET_LATEST,
//     TEXT,
//     FILE_OFFER,
//     IMAGE_OFFER,
//     RETRACT_FILE_OFFER,
//     REMOVE_FILE_REQUEST,
//     REQUEST_MEDIA_HINT,
// }

// export enum PoolMessageAction {
//     DEFAULT,
//     REQUEST,
//     REPLY,
// }

// export enum PoolNodeState {
//     INACTIVE,
//     ACTIVE,
// }

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

// export interface PoolMessage {
//     msgID: string;
//     type: PoolMessageType;
//     userID: string;
//     created: number;
//     data: any;
//     received?: number;
// }

// export interface PoolMessagePackage {
//     src: PoolMessageSourceInfo;
//     dests?: PoolMessageDestinationInfo[];
//     action: PoolMessageAction;
//     partnerIntPath: number | null;
//     msg: PoolMessage;
// }

// export interface PoolMessageSourceInfo {
//     nodeID: string;
//     path: number[];
// }

// export interface PoolMessageDestinationInfo {
//     nodeID: string;
//     visited: boolean;
// }

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
    fileOffers: PoolFileOffer[];
}

export interface PoolSettings {
    maxTextLength: number;
    maxMediaSize: number;
}

// export interface PoolUpdateLatestInfo {
//     messagesOnly: boolean;
//     lastMessageID: string;
//     fileSeeders: PoolFileSeeders[];
//     messages: PoolMessage[];
// }

// export interface PoolUpdateNodeState {
//     nodeID: string;
//     userID: string;
//     state: PoolNodeState;
// }

// export interface PoolFileInfo {
//     fileID: string;
//     originNodeID: string;
//     fileName: string;
//     totalSize: number;
// }

// export interface PoolFileOffer extends PoolFileInfo {
//     seederNodeID: string
// }

// export interface PoolFileSeeders extends PoolFileInfo {
//     seederNodeIDs: string[];
// } 

// export type PoolChunkRange = number[];

// export interface PoolFileRequest {
//     fileID: string;
//     requestingNodeID: string;
//     chunksMissing: PoolChunkRange[];
//     cacheChunksCovered: number[];
// }

// export interface PoolMediaOffer extends PoolFileOffer {
//     extension: string;
// }

// export interface PoolImageOffer extends PoolMediaOffer {
//     width: number;
//     height: number;
//     previewImage: string;
// }

// export interface PoolRemoveFileRequest {
//     requestingNodeID: string;
//     fileID: string;
// }

// export interface PoolRequestMediaHint {
//     fileInfo: PoolFileInfo;
// }

// export interface PoolRetractFileOffer {
//     fileID: string;
//     nodeID: string;
// }

// export function isMediaType(type: PoolMessageType): boolean {
//     return type == PoolMessageType.IMAGE_OFFER;
// }