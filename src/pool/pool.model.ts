import { nanoid } from "nanoid";

export const NODE_ID_LENGTH = 10;
export const MESSAGE_ID_LENGTH = 21;
export const FILE_ID_LENGTH = 21;

export enum PoolMessageType {
    SIGNAL_STATUS,
    GET_LATEST,
    TEXT,
    FILE,
    IMAGE,
    RETRACT_FILE_OFFER,
    REMOVE_FILE_REQUEST,
    REQUEST_MEDIA_HINT,
}

export enum PoolMessageAction {
    DEFAULT,
    REQUEST,
    REPLY,
}

export enum PoolNodeState {
    INACTIVE,
    ACTIVE,
}

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

export enum DeviceType {
    BROWSER,
    DESKTOP,
    MOBILE,
}

export interface PoolMessageView {
    msgID: string;
    type: PoolMessageType;
    userID: string;
    created: number;
    data: any;
    received?: number;
}

export interface PoolMessage extends PoolMessageView {
    src: PoolMessageSourceInfo;
    dests?: PoolMessageDestinationInfo[];
    action: PoolMessageAction;
    partnerIntPath: number | null;
}

export interface PoolMessageSourceInfo {
    nodeID: string;
    path: number[];
}

export interface PoolMessageDestinationInfo {
    nodeID: string;
    lastSeenPath: number[];
    visited: boolean;
}

export interface PoolMessageInfo {
    msgID: string;
    received: number;
}

export interface PoolInfo {
    PoolID: string;
    PoolName: string;
    Users: PoolUser[];
    Key: number;
    Settings: PoolSettings
}

export interface Pool {
    PoolID: string;
    PoolName: string;
    Users: PoolUser[];
    PoolSettings: PoolSettings;
    key: number;
    connectionState: PoolConnectionState;
    myNode: PoolNode;
    activeNodes: PoolNode[];
    downloadQueue: PoolFileProgress[];
    messages: PoolMessageView[];
}

export interface PoolSettings {
    maxTextLength: number;
    maxMediaSize: number;
}

export interface PoolUpdateLatestInfo {
    messagesOnly: boolean;
    lastMessageID: string;
    activeNodes: PoolNode[];
    messages: PoolMessageView[];
}

export interface PoolUser {
    UserID: string;
    DisplayName: string;
    Devices: PoolDevice[];
}

export interface PoolDevice {
    deviceID: string;    
    deviceType: DeviceType;
    deviceName: string;
}

export interface PoolNode {
    nodeID: string;
    userID: string;
    deviceID: string;
    state: PoolNodeState;
    fileOffers: PoolFileInfo[];
    lastSeenPath: number[];
}

export interface PoolUpdateNodeState {
    nodeID: string;
    userID: string;
    state: PoolNodeState;
}

export interface PoolFileInfo {
    fileID: string;
    nodeID: string;
    originNodeID: string;
    fileName: string;
    totalSize: number;
}

export interface PoolFileProgress extends PoolFileInfo {
    progress: number;
    status: PoolDownloadProgressStatus;
}

export type PoolChunkRange = number[];

export interface PoolFileRequest {
    fileID: string;
    requestingNodeID: string;
    chunksMissing: PoolChunkRange[];
    cacheChunksCovered: number[];
}

export interface PoolMediaInfo {
    fileInfo: PoolFileInfo;
    extension: string;
}

export interface PoolImageInfo extends PoolMediaInfo {
    width: number;
    height: number;
    previewImage: string;
}

export interface PoolRemoveFileRequest {
    requestingNodeID: string;
    fileID: string;
}

export interface PoolRequestMediaHint {
    fileInfo: PoolFileInfo;
}

export interface PoolRetractFileOffer {
    fileID: string;
    nodeID: string;
}

export function isMediaType(type: PoolMessageType): boolean {
    return type == PoolMessageType.IMAGE;
}