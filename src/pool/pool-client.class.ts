import { NodeStatusData, Report, ReportNodeData, SDPData, Status, SyncWSMessage } from "./sync-server.model";
import { SendSyncWSMessage } from "./connect-pool";

interface NodeConnection {
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
}

interface NodePosition {
    NodeID: string;
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodes: string[][];
    ChildClusterPartners: string[];
}

export class PoolClient {
    poolID: string;
    ws: WebSocket;
    nodePosition: NodePosition;
    nodeConnections: Map<string, NodeConnection>;

    reconnect: boolean;

    constructor(poolID: string, ws: WebSocket) {
        this.poolID = poolID;
        this.ws = ws;
        this.nodePosition = {} as NodePosition;
        this.nodeConnections = new Map<string, NodeConnection>();
        this.reconnect = true;
    }

    disconnectFromPool() {
        this.reconnect = false;
        this.ws.close();
    }

    disconnectAllNodeConnections() {
        this.nodeConnections.forEach((nodeConn) => {
            closeNodeConnection(nodeConn)
        })
    }

    updateNodePosition(msg: SyncWSMessage) {
        this.nodePosition = msg.Data;
        SendSyncWSMessage(this.ws, 2000, undefined, msg);
    }

    sendOffer(msg: SyncWSMessage) {
        if (this.nodeConnections.has(msg.TargetNodeID)) {
            closeNodeConnection(this.nodeConnections.get(msg.TargetNodeID)!);
            this.nodeConnections.delete(msg.TargetNodeID);
        }
    
        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);
    
        this.initializeMainDataChannelFunctions(dataChannel, msg.TargetNodeID);
    
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            SendSyncWSMessage(this.ws, 2003, { SDP: JSON.stringify(connection.localDescription), Status: Status.SUCCESSFUL } as SDPData, msg);
        }
    
        connection.createOffer().then(
            (d) => connection.setLocalDescription(d), 
            () => SendSyncWSMessage(this.ws, 2003, { SDP: "", Status: Status.UNSUCCESSFUL } as SDPData, msg)
        );
    
        let nodeConnection: NodeConnection = {
            connection: connection,
            dataChannel: dataChannel,
        };
    
        this.nodeConnections.set(msg.TargetNodeID, nodeConnection);
    }

    answerOffer(msg: SyncWSMessage) {
        if (this.nodeConnections.has(msg.TargetNodeID)) {
            closeNodeConnection(this.nodeConnections.get(msg.TargetNodeID)!);
            this.nodeConnections.delete(msg.TargetNodeID);
        }
    
        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);
    
        this.initializeMainDataChannelFunctions(dataChannel, msg.TargetNodeID);
    
        dataChannel.onopen = (e) => {
            console.log("DATA CHANNEL WITH", msg.TargetNodeID, "OPENED");
        }
    
        let sdpData: SDPData = msg.Data;
    
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            SendSyncWSMessage(this.ws, 2004, { SDP: JSON.stringify(connection.localDescription), Status: Status.SUCCESSFUL } as SDPData, msg);
        }
    
        connection.setRemoteDescription(JSON.parse(sdpData.SDP)).then(() => connection.createAnswer().then(
            (d) => connection.setLocalDescription(d), 
            () => SendSyncWSMessage(this.ws, 2004, { SDP: "", Status: Status.UNSUCCESSFUL } as SDPData, msg)
        ), () => SendSyncWSMessage(this.ws, 2004, { SDP: "", Status: Status.UNSUCCESSFUL } as SDPData, msg));
    
        let nodeConnection: NodeConnection = {
            connection: connection,
            dataChannel: dataChannel,
        };
    
        this.nodeConnections.set(msg.TargetNodeID, nodeConnection);
    }

    finalizeConnectNode(msg: SyncWSMessage) {

        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
    
        if (!nodeConnection) {
            SendSyncWSMessage(this.ws, 2001, { Status: Status.UNSUCCESSFUL } as NodeStatusData, msg);
            return;
        }
    
        let sdpData: SDPData = msg.Data;
    
        nodeConnection.dataChannel.onopen = (e) => {
            console.log("DATA CHANNEL WITH", msg.TargetNodeID, "OPENED");
            SendSyncWSMessage(this.ws, 2001, { Status: Status.SUCCESSFUL } as NodeStatusData, msg);
        }
    
        nodeConnection.connection.setRemoteDescription(JSON.parse(sdpData.SDP)).then(null , 
            () => {
                SendSyncWSMessage(this.ws, 2001, { Status: Status.UNSUCCESSFUL } as NodeStatusData, msg)
            }
        );
    }

    disconnectNode(msg: SyncWSMessage) {
        SendSyncWSMessage(this.ws, 2002, undefined, msg);
        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection) return;
        closeNodeConnection(nodeConnection);
        this.nodeConnections.delete(msg.TargetNodeID);
    }

    verifyConnection(msg: SyncWSMessage) {
        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            SendSyncWSMessage(this.ws, 2005, { Status: Status.UNSUCCESSFUL } as NodeStatusData, msg);
            return;
        }
        SendSyncWSMessage(this.ws, 2005, { Status: Status.SUCCESSFUL } as NodeStatusData, msg);
    }

    private initializeMainDataChannelFunctions(dataChannel: RTCDataChannel, targetNodeID: string) {
        dataChannel.onmessage = (e) => {
            console.log("DC message RECV", e);
        };
    
        dataChannel.onclose = (e) => {
            SendSyncWSMessage(this.ws, 2006, { ReportCode: Report.DISCONNECT_REPORT } as ReportNodeData, undefined, targetNodeID);
        }
    
    }
}

function initializeRTCPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]})
}

function initializeMainDataChannel(connection: RTCPeerConnection): RTCDataChannel {
    return connection.createDataChannel("main", {
        ordered: true,
        negotiated: true,
        id: 0,
    });
}

export function closeNodeConnection(nodeConnection: NodeConnection) {
    nodeConnection.connection.close();
    nodeConnection.dataChannel?.close();
}