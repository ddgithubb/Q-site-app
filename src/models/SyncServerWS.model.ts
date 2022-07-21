
export enum Status {
    UNSUCCESSFUL = 0,
    SUCCESSFUL = 1,
}

export enum Report {
    DISCONNECT_REPORT = 0,
    RECONNECT_REPORT = 1,
}

export interface WSMessage {
    Op: number;
    Key: string;
    TargetNodeID: string;
    Data: any
}

export interface SDPData {
    SDP: string;
    Status: number;
}

export interface NodeStatusData {
    Status: number;
}

export interface ReportNodeData {
    ReportCode: number;
}