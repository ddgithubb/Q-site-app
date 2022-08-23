
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

export interface SSDisconnectData {
    RemoveFromPool: boolean;
}

export interface SSNodeStatusData {
    Status: number;
}

export interface SSReportNodeData {
    ReportCode: number;
}