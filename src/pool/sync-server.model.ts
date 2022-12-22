import { PoolBasicNode, PoolNodeInfo } from "./pool.model";

export enum SSStatus {
    UNSUCCESSFUL = 0,
    SUCCESSFUL = 1,
}

export enum SSReportCodes {
    DISCONNECT_REPORT = 0,
    RECONNECT_REPORT = 1,
}

export interface SSLwtMessage {
    Op: number;
    Data: any
}

export interface SSMessage {
    Op: number;
    Key: string;
    TargetNodeID: string;
    Data: any
}

export interface SSSDPData {
    SDP: string;
    Status: number;
}

export interface SSNodeStatusData {
    Status: number;
}

export interface SSReportNodeData {
    ReportCode: number;
}

export type SSAddNodesData = SSAddNodeData[];

export interface SSAddNodeData {
    NodeID: string;
    Path: number[];
    Timestamp: number;
    NodeInfo: PoolNodeInfo; 
}

export interface SSRemoveNodeData {
    NodeID: string;
    Timestamp: number;
    PromotedNodes: PoolBasicNode[]
}