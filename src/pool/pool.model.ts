import { nanoid } from "nanoid";
import { DeviceType } from "../store/slices/profile.slice";

export const NODE_ID_LENGTH = 10;
export const MESSAGE_ID_LENGTH = 21;
export const FILE_ID_LENGTH = 21;

export enum PoolMessageType {
    SIGNAL_STATUS,
    GET_LATEST,
    TEXT,
    FILE,
    RETRACT_MESSAGE,
    ANNOUNCEMENT,
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

export interface PoolMessage {
    src: PoolMessageSourceInfo;
    dest?: PoolMessageDestinationInfo;
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
    activeDevices?: PoolNode[];
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
    state: PoolNodeState;
}

export interface PoolFileInfo {
    fileID: string;
    nodeID: string;
    fileName: string;
    totalSize: number;
}

export type PoolChunkRange = number[];

export interface PoolFileRequest {
    fileID: string;
    requestFromOrigin: boolean;
    chunksMissing: PoolChunkRange[];
    cacheChunksCovered: number[];
    cacheChunksSet?: Set<number>;
    cancelled?: boolean;
}

export interface PoolRetractMessage {
    type: PoolMessageType;
    id: string; // msgID or fileID
}