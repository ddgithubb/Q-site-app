import { NodeStatusData, Report, ReportNodeData, SDPData, Status, SyncWSMessage } from "./sync-server.model";
import { SendSyncWSMessage } from "./connect-pool";
import { NodeState, Pool, PoolUpdateLatest, PoolMessage, PoolMessageType, PoolNode } from "./pool.model";
import { getStoreState, store } from "../store/store";
import { AddActiveNodeAction, AddMessageAction, poolAction, ReceivedMessageAction, RemoveActiveNodeAction, UpdateLatestAction } from "../store/slices/pool.slice";
import { MAXIMUM_GET_LATEST_MESSAGE_LENGTH } from "../config/caching";
import { nanoid } from "nanoid";

interface BasicNode {
    NodeID: string;
    UserID: string;
}

interface NodeConnection {
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
}

interface NodePosition {
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodes: BasicNode[][];
    ChildClusterPartners: BasicNode[];
}

export class PoolClient {
    nodeID: string;
    poolKey: number;
    ws: WebSocket;
    nodePosition: NodePosition;
    nodeConnections: Map<string, NodeConnection>;
    reconnect: boolean;
    new: boolean;
    latest: boolean

    constructor(pool: Pool, ws: WebSocket) {
        this.nodeID = "";
        this.poolKey = pool.key;
        this.ws = ws;
        this.nodePosition = {} as NodePosition;
        this.nodeConnections = new Map<string, NodeConnection>();
        this.reconnect = true;
        this.new = true;
        this.latest = false;
    }

    getPool(): Pool {
        return getStoreState().pool.pools[this.poolKey]
    }

    getPanelNumber() {
        return this.nodePosition.Path[this.nodePosition.Path.length - 1]
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
        this.nodeID = msg.TargetNodeID;
        if (this.new) {
            let profileState = getStoreState().profile;
            store.dispatch(poolAction.resetPool({
                key: this.poolKey,
                self: true,
                node: {
                    nodeID: this.nodeID,
                    userID: profileState.userID,
                    state: NodeState.ACTIVE,
                    lastSeenPath: this.nodePosition.Path,
                    deviceType: profileState.deviceType,
                    deviceName: profileState.deviceName,
                    fileOffers: [],
                } as PoolNode,
            } as AddActiveNodeAction));
            this.new = false;
        }
        SendSyncWSMessage(this.ws, 2000, undefined, msg);
    }

    sendOffer(msg: SyncWSMessage) {
        if (this.nodeConnections.has(msg.TargetNodeID)) {
            closeNodeConnection(this.nodeConnections.get(msg.TargetNodeID)!);
            this.nodeConnections.delete(msg.TargetNodeID);
        }
    
        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);
    
        this.mainDataChannelFunctions(dataChannel, msg.TargetNodeID);
    
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
    
        this.mainDataChannelFunctions(dataChannel, msg.TargetNodeID);
    
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
            this.sendActiveNodeSignal(msg.TargetNodeID);
            SendSyncWSMessage(this.ws, 2001, { Status: Status.SUCCESSFUL } as NodeStatusData, msg);
            if (!this.latest) {
                this.sendGetLatest(msg.TargetNodeID);
            }
        }
    
        nodeConnection.connection.setRemoteDescription(JSON.parse(sdpData.SDP)).then(null , 
            () => {
                SendSyncWSMessage(this.ws, 2001, { Status: Status.UNSUCCESSFUL } as NodeStatusData, msg)
            }
        );
    }

    disconnectNode(msg: SyncWSMessage) {
        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
        if (nodeConnection){
            closeNodeConnection(nodeConnection);
            this.nodeConnections.delete(msg.TargetNodeID);
        }
        this.sendInactiveNodeSignal(msg.TargetNodeID);
        SendSyncWSMessage(this.ws, 2002, undefined, msg);
    }

    verifyConnection(msg: SyncWSMessage) {
        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            SendSyncWSMessage(this.ws, 2005, { Status: Status.UNSUCCESSFUL } as NodeStatusData, msg);
            return;
        }
        SendSyncWSMessage(this.ws, 2005, { Status: Status.SUCCESSFUL } as NodeStatusData, msg);
    }

    sendActiveNodeSignal(nodeID: string) {
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.SIGNAL_STATUS, this.getPool().myNode)));
    }

    sendInactiveNodeSignal(nodeID: string) {
        this.handleMessage(this.createMessage(PoolMessageType.SIGNAL_STATUS, {
            nodeID: nodeID,
            state: NodeState.INACTIVE,
        } as PoolNode)!);
    }

    sendGetLatest(nodeID: string) {
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, undefined, nodeID)));
    }

    sendRespondGetLatest(nodeID: string) {
        let pool = this.getPool();
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, {
            activeNodes: pool.activeNodes,
            messages: pool.messages.slice(-MAXIMUM_GET_LATEST_MESSAGE_LENGTH),
        } as PoolUpdateLatest, nodeID)))
    }

    sendTextMessage(text: string) {
        this.handleMessage(this.createMessage(PoolMessageType.TEXT, text))
    }

    handleMessage(msg?: PoolMessage) {

        if (!msg) return;

        let pool = this.getPool();
        let poolMessageExists: boolean = false;
        for (let i = pool.receivedMessages.length - 1; i >= 0; i--) {
            if (pool.receivedMessages[i].received < msg.created) {
                break
            } else {
                if (pool.receivedMessages[i].msgID == msg.msgID) {
                    poolMessageExists = true;
                }
            }
        }
        if (poolMessageExists) return;

        store.dispatch(poolAction.receivedMessage({
            key: this.poolKey,
            msgID: msg.msgID,
        } as ReceivedMessageAction));

        if (msg.dest && msg.dest.nodeID == this.nodeID) {
            // console.log("GOT PERSONAL MESSAGE", msg);
            if (msg.type == PoolMessageType.GET_LATEST) {
                if (msg.data) {
                    store.dispatch(poolAction.updateLatest({
                        key: this.poolKey,
                        latest: msg.data,
                    } as UpdateLatestAction))
                    this.latest = true;
                } else {
                    this.sendRespondGetLatest(msg.src.nodeID);
                }
            }
            return
        }

        let msgStr = JSON.stringify(msg)
        let panelNumber = this.getPanelNumber();

        if (!msg.dest) {
            switch (msg.type) {
            case PoolMessageType.TEXT:
            case PoolMessageType.FILE:
                store.dispatch(poolAction.addMessage({
                    key: this.poolKey,
                    message: msg,
                } as AddMessageAction));
                break;
            case PoolMessageType.SIGNAL_STATUS:
                let existingNode: PoolNode | undefined = undefined;
                for (const node of pool.activeNodes) {
                    if (node.nodeID == msg.data.nodeID) {
                        existingNode = node;
                        break;
                    }
                }
                if (msg.data.state == NodeState.ACTIVE && !existingNode) {
                    if (msg.data.nodeID != this.nodeID) {
                        store.dispatch(poolAction.addActiveNode({
                            key: this.poolKey,
                            node: msg.data,
                        } as AddActiveNodeAction));
                    }
                } else if (msg.data.state == NodeState.INACTIVE && existingNode && !this.nodeConnections.get(msg.data.nodeID)) {
                    store.dispatch(poolAction.removeActiveNode({
                        key: this.poolKey,
                        nodeID: msg.data.nodeID,
                    } as RemoveActiveNodeAction));
                } else {
                    return
                }
                break;
            default:
                return
            }
        } else {
            if (msg.dest.lastSeenPath.length == 0) return;

            switch (msg.type) {
            case PoolMessageType.GET_LATEST:
                break;
            case PoolMessageType.REQUEST_FILE:
                break;
            case PoolMessageType.SEND_FILE_SHARD:
                break;
            default:
                return
            }

            let foundNodeID = "";
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID;
                if (nodeID != this.nodeID && nodeID == msg.dest.nodeID) {
                    foundNodeID = nodeID;
                    break
                }
            }

            if (foundNodeID != "") {
                this.sendDataChannel(foundNodeID, msgStr);
                return
            }
        }
        
        for (let i = 0; i < 3; i++) {
            this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID, msgStr);
        }

        if (msg.dest) {
            let matches = 0;
            let srcDestMatches = 0;
            if (this.nodePosition.Path.length <= msg.dest.lastSeenPath.length) {
                for (let i = 0; i < this.nodePosition.Path.length; i++) {
                    if (this.nodePosition.Path[i] == msg.dest.lastSeenPath[i]) {
                        matches++;
                    } else {
                        matches = 0;
                        break;
                    }
                }
                if (matches != 0) {
                    for (let i = 0; i < Math.min(msg.src.path.length, msg.dest.lastSeenPath.length); i++) {
                        if (msg.src.path[i] == msg.dest.lastSeenPath[i]) {
                            matches++;
                        } else {
                            break;
                        }
                    }
                }
            }
            if (matches == 0) {
                if (this.nodePosition.CenterCluster) {
                    this.sendToParentClusterPanel(msg.dest.lastSeenPath[0], msgStr);
                } else {
                    this.sendToParentClusterPanel(2, msgStr);
                }
            } else {
                if (matches != 1 && matches <= srcDestMatches) {
                    this.sendToParentClusterPanel(2, msgStr);
                }
                if (matches != msg.dest.lastSeenPath.length && matches >= srcDestMatches) {
                    this.sendToChildClusterPartner(msg.dest.lastSeenPath[matches], msgStr);
                }
            } 
        } else {
            let sendDown = true;
            let sendUp = false;
            if (this.nodePosition.Path.length < msg.src.path.length) {
                for (let i = 0; i < this.nodePosition.Path.length; i++) {
                    if (this.nodePosition.Path[i] != msg.src.path[i]) {
                        sendDown = true;
                        sendUp = false;
                        break;
                    } else {
                        sendDown = false;
                        sendUp = true;
                    }
                }
            } else if (this.nodePosition.Path.length == msg.src.path.length && this.nodePosition.Path.every((v, i) => v == msg.src.path[i])) {
                sendDown = true;
                sendUp = true;
            }

            if (sendDown) {
                for (let i = 0; i < 2; i++) {
                    this.sendToChildClusterPartner(i, msgStr);
                }
            } 
            if (sendUp) {
                for (let i = 0; i < 3; i++) {
                    if (i != panelNumber) {
                        this.sendToParentClusterPanel(i, msgStr);
                    }
                }
            }
        }
    }
    
    private mainDataChannelFunctions(dataChannel: RTCDataChannel, targetNodeID: string) {
        dataChannel.onmessage = (e: MessageEvent<string>) => {
            console.log("DC RECV", e.data);
            if (e.data == "") return;
            let msg: PoolMessage = JSON.parse(e.data);
            if (msg.src.nodeID == this.nodeID) return;
            this.handleMessage(msg);
        };
    
        dataChannel.onclose = (e) => {
            SendSyncWSMessage(this.ws, 2006, { ReportCode: Report.DISCONNECT_REPORT } as ReportNodeData, undefined, targetNodeID);
        }
    }

    sendDataChannel(nodeID: string, msgStr: string): boolean {
        if (nodeID == "") return false;
        let nc = this.nodeConnections.get(nodeID);
        if (nc && nc.dataChannel.readyState == 'open') {
            console.log("DC SEND", msgStr)
            nc.dataChannel.send(msgStr)
            return true
        }
        return false
    }

    sendToParentClusterPanel(panelNumber: number, msgStr: string) {
        if (!this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][this.nodePosition.PartnerInt].NodeID, msgStr) && this.nodePosition.CenterCluster) {
            for (let i = 0; i < 3; i++) {
                if (i != this.nodePosition.PartnerInt) {
                    if (this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID, msgStr)) {
                        return
                    }
                }
            }
        }
    }

    sendToChildClusterPartner(panelNumber: number, msgStr: string) {
        this.sendDataChannel(this.nodePosition.ChildClusterPartners[panelNumber].NodeID, msgStr);
    }

    createMessage(type: PoolMessageType, data?: any, destNodeID?: string): PoolMessage | undefined {
        let lastSeenPath: number[] = [];
        if (destNodeID) {
            for (const node of this.getPool().activeNodes) {
                if (node.nodeID == destNodeID) {
                    lastSeenPath = node.lastSeenPath;
                    break;
                }
            }
        }
        return {
            src: {
                userID: getStoreState().profile.userID,
                nodeID: this.nodeID,
                path: this.nodePosition.Path,
            },
            dest: destNodeID ? {
                nodeID: destNodeID,
                lastSeenPath: lastSeenPath
            } : undefined,
            type: type,
            created: Date.now(),
            msgID: nanoid(10),
            data: data,
        } as PoolMessage;
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