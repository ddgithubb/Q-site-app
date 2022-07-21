
export interface Pool {
    poolID: string;
    wsConn: WebSocket;
    nodePosition: NodePosition;
    nodeConnections: Map<string, NodeConnection>;
    reconnect: boolean;
}

export interface NodeConnection {
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
}

export interface NodePosition {
    NodeID: string;
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodeIDs: string[][];
    ChildClusterPartnerNodeIDs: string[];
}