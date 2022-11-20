import { nanoid } from "nanoid";
import { DeviceType } from "../store/slices/profile.slice";

export const NODE_ID_LENGTH = 10;
export const MESSAGE_ID_LENGTH = 21;
export const FILE_ID_LENGTH = 21;

export enum PoolMessageType {
    SIGNAL_STATUS,
    GET_LATEST,
    RETRACT_MESSAGE,
    TEXT,
    FILE,
    IMAGE,
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

export interface PoolMessage {
    src: PoolMessageSourceInfo;
    dests?: PoolMessageDestinationInfo[];
    type: PoolMessageType;
    action: PoolMessageAction;
    msgID: string;
    userID: string
    created: number;
    data: any;
    partnerIntPath: number | null;
    received?: number;
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
    messages: PoolMessage[];
}

export interface PoolSettings {
    maxTextLength: number;
    maxMediaSize: number;
}

export interface PoolUpdateLatestInfo {
    messagesOnly: boolean;
    lastMessageID: string;
    activeNodes: PoolNode[];
    messages: PoolMessage[];
}

export interface PoolUser {
    UserID: string;
    DisplayName: string;
    activeNodes?: PoolNode[];
}

export interface PoolNode {
    nodeID: string;
    userID: string;
    state: PoolNodeState;
    deviceType: DeviceType;
    deviceName: string;
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

export interface PoolRequestMediaHint {
    fileInfo: PoolFileInfo;
}

export interface PoolRetractMessage {
    type: PoolMessageType;
    id: string; // msgID or fileID
}

export function isMediaType(type: PoolMessageType): boolean {
    return type == PoolMessageType.IMAGE;
}