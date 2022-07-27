import { nanoid } from "nanoid";
import { DeviceType } from "../store/slices/profile.slice";

export enum PoolMessageType {
    SIGNAL_STATUS,
    GET_LATEST,
    TEXT,
    FILE,
    REQUEST_FILE,
    SEND_FILE_SHARD,
    ANNOUNCEMENT,
}

export enum NodeState {
    INACTIVE,
    ACTIVE,
}

export interface PoolMessage {
    src: {
        userID: string
        nodeID: string;
        path: number[];
    }
    dest?: {
        nodeID: string;
        lastSeenPath: number[];
    }
    type: PoolMessageType;
    created: number;
    msgID: string;
    data: any;
    received?: number;
}

export interface PoolMessageInfo {
    msgID: string;
    received: number;
}

export interface Pool {
    poolID: string;
    users: PoolUser[];
    key: number;
    myNode: PoolNode;
    activeNodes: PoolNode[];
    messages: PoolMessage[];
    receivedMessages: PoolMessageInfo[];
}

export interface PoolUpdateLatest {
    activeNodes: PoolNode[];
    messages: PoolMessage[];
}

export interface PoolInfo {
    PoolID: string;
    Users: PoolUser[];
    Key: number;
}

export interface PoolUser {
    userID: string;
    displayName: string;
    // other user info
}

export interface PoolNode {
    nodeID: string;
    userID: string;
    state: NodeState;
    lastSeenPath: number[];
    deviceType: DeviceType;
    deviceName: string;
    fileOffers: PoolFile[];
}

export interface PoolFile {
    fileName: string;
    filePath: string;
    // other file info
}