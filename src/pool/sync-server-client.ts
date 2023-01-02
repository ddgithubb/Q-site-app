import { SYNC_SERVER_CONNECT_ENDPOINT, HEARTBEAT_TIMEOUT_SECONDS, HEARTBEAT_INTERVAL_SECONDS } from "../config/http";
import { SSMessage, SSMessage_Op, SSMessage_ReportCode } from "../sstypes/sync_server.v1";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";
import { getStoreState, store } from "../store/store";
import { validateSSState } from "../views/static/MaintenancePage";
import { PoolManager } from "./global";
import { PoolClient, PoolNodePosition } from "./pool-client";
import { PoolConnectionState } from "./pool.model";
// import { SSLwtMessage, SSMessage, SSNodeStatusData, SSSDPData, SSStatus } from "./sync-server.model";

export function initializePool(poolID: string, poolKey: number): PoolClient {
    var ssMsg: SSMessage;
    var heartbeatInterval: any = undefined;
    var heartbeatTimeout: any = undefined;
    var ws: WebSocket = new WebSocket(SYNC_SERVER_CONNECT_ENDPOINT + "?poolid=" + poolID + "&displayname=" + getStoreState().profile.displayName);
    var poolClient: PoolClient = new PoolClient(poolID, poolKey, ws);

    window.MainPoolClient = poolClient;
    
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
        console.log("WS OPEN");
        store.dispatch(poolAction.updateConnectionState({ // TEMP (shouild be controlled by poolClient)
            key: poolKey,
            state: PoolConnectionState.CONNECTED,
        } as UpdateConnectionStateAction));
        let heartbeatMessage: SSMessage = {
            op: SSMessage_Op.HEARTBEAT,
            key: "",
        };
        let heartbeatMessageBuffer: Uint8Array = SSMessage.encode(heartbeatMessage).finish();
        heartbeatInterval = setInterval(() => {
            ws.send(heartbeatMessageBuffer);
            heartbeatTimeout = setTimeout(() => {
                console.log("Heartbeat TIMEOUT");
                PoolManager.reconnectToPool(poolID, poolKey);
            }, HEARTBEAT_TIMEOUT_SECONDS * 1000);
        }, HEARTBEAT_INTERVAL_SECONDS * 1000);
    };
    ws.onmessage = (event) => {
        //wsMsg = JSON.parse(event.data);
        // console.log("WS BINARY MSG", event.data);
        ssMsg = SSMessage.decode(new Uint8Array(event.data as ArrayBuffer));
        
        if (ssMsg.op == SSMessage_Op.CLOSE) {
            PoolManager.reconnectToPool(poolID, poolKey);
            return;
        }

        if (ssMsg.op == SSMessage_Op.HEARTBEAT) {
            clearTimeout(heartbeatTimeout);
            return;
        }

        console.log("WS RECV", JSON.stringify(ssMsg));

        handleSSMessage(poolClient, ssMsg);
    }
    ws.onclose = (event) => {
        console.error("WS CLOSED", event);
        clearInterval(heartbeatInterval);
        clearTimeout(heartbeatTimeout);
        poolClient.clean();
        if (poolClient.reconnect) {
            PoolManager.reconnectToPool(poolID, poolKey);
        }
    };
    ws.onerror = async (error: any) => {
        console.error("WS ERROR", error);
        validateSSState();
    };

    return poolClient;
}

function handleSSMessage(pool: PoolClient, ssMsg: SSMessage) {
    let responseSSMsg: SSMessage;
    switch (ssMsg.op) {
    case SSMessage_Op.UPDATE_NODE_POSITION:
        if (!ssMsg.updateNodePositionData) break;
        let parentClusterNodeIDs: string[][] = [];
        let childClusterNodeIDs: string[][] = [];
        let index = 0;
        for (let i = 0; i < 3; i++) {
            parentClusterNodeIDs[i] = [];
            for (let j = 0; j < 3; j++) {
                parentClusterNodeIDs[i][j] = ssMsg.updateNodePositionData.parentClusterNodeIds[index];
                index++;
            }
        }
        index = 0;
        for (let i = 0; i < 2; i++) {
            childClusterNodeIDs[i] = [];
            for (let j = 0; j < 3; j++) {
                childClusterNodeIDs[i][j] = ssMsg.updateNodePositionData.childClusterNodeIds[index];
                index++;
            }
        }
        let nodePosition: PoolNodePosition = {
            path: ssMsg.updateNodePositionData.path,
            partnerInt: ssMsg.updateNodePositionData.partnerInt,
            centerCluster: ssMsg.updateNodePositionData.centerCluster,
            parentClusterNodeIDs: parentClusterNodeIDs,
            childClusterNodeIDs: childClusterNodeIDs,
        };
        pool.updateNodePosition(nodePosition);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    case SSMessage_Op.CONNECT_NODE:
        //console.warn(msg.Key, "2001 START", msg.TargetNodeID);
        if (!ssMsg.connectNodeData) break;
        responseSSMsg = createResponseSSMsg(ssMsg, SSMessage_Op.SEND_OFFER);
        pool.getOffer(ssMsg.connectNodeData.nodeId).then((sdp) => {
            responseSSMsg.sdpResponseData = {
                sdp: sdp,
                success: true,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2001 SUCCESS");
        }).catch(() => {
            responseSSMsg.sdpResponseData = {
                sdp: "",
                success: false,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2001 FAIL");
        });
        break;
    case SSMessage_Op.DISCONNECT_NODE:
        //console.log("DISCONNECT NODE", msg.TargetNodeID);
        if (!ssMsg.disconnectNodeData) break;
        pool.disconnectNode(ssMsg.disconnectNodeData.nodeId);
        responseSSMsg = createResponseSSMsg(ssMsg, SSMessage_Op.DISCONNECT_NODE)
        sendSSMessage(pool.ws, responseSSMsg);
        break;
    case SSMessage_Op.SEND_OFFER:
        //console.warn(msg.Key, "2003 START", msg.TargetNodeID);
        if (!ssMsg.sdpOfferData) break;
        responseSSMsg = createResponseSSMsg(ssMsg, SSMessage_Op.ANSWER_OFFER);
        pool.answerOffer(ssMsg.sdpOfferData.fromNodeId, ssMsg.sdpOfferData.sdp).then((sdp) => {
            responseSSMsg.sdpResponseData = {
                sdp: sdp,
                success: true,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2003 SUCCESS");
        }).catch(() => {
            responseSSMsg.sdpResponseData = {
                sdp: "",
                success: false,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2003 FAIL");
        });
        break;
    case SSMessage_Op.ANSWER_OFFER:
        //console.warn(msg.Key, "2004 START", msg.TargetNodeID);
        if (!ssMsg.sdpOfferData) break;
        responseSSMsg = createResponseSSMsg(ssMsg, SSMessage_Op.CONNECT_NODE);
        pool.connectNode(ssMsg.sdpOfferData.fromNodeId, ssMsg.sdpOfferData.sdp).then(() => {
            responseSSMsg.successResponseData = {
                success: true,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2004 SUCCESS");
        }).catch(() => {
            responseSSMsg.successResponseData = {
                success: false,
            };
            sendSSMessage(pool.ws, responseSSMsg);
            //console.warn(msg.Key, "2004 FAIL");
        });
        break;
    case SSMessage_Op.VERIFY_NODE_CONNECTED:
        if (!ssMsg.verifyNodeConnectedData) break;
        responseSSMsg = createResponseSSMsg(ssMsg, SSMessage_Op.VERIFY_NODE_CONNECTED);
        if (pool.verifyConnection(ssMsg.verifyNodeConnectedData.nodeId)) {
            responseSSMsg.successResponseData = {
                success: true,
            };
            sendSSMessage(pool.ws, responseSSMsg);
        } else {
            responseSSMsg.successResponseData = {
                success: false,
            };
            sendSSMessage(pool.ws, responseSSMsg);
        }
        break;
    case SSMessage_Op.INIT_POOL:
        if (!ssMsg.initPoolData) break;
        pool.initPool(ssMsg.initPoolData);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    case SSMessage_Op.ADD_NODE:
        if (!ssMsg.addNodeData) break;
        pool.addNode(ssMsg.addNodeData);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    case SSMessage_Op.REMOVE_NODE:
        if (!ssMsg.removeNodeData) break;
        pool.removeNode(ssMsg.removeNodeData);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    case SSMessage_Op.UPDATE_USER:
        if (!ssMsg.updateUserData) break;
        pool.updateUser(ssMsg.updateUserData);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    case SSMessage_Op.REMOVE_USER:
        if (!ssMsg.removeUserData) break;
        pool.removeUser(ssMsg.removeUserData);
        sendACKSSMsg(pool.ws, ssMsg);
        break;
    }
}

export function sendSSMessage(ws: WebSocket, ssMsg: SSMessage) {
    console.log("WS SEND:", JSON.stringify(ssMsg));
    ws.send(SSMessage.encode(ssMsg).finish());
}

function createResponseSSMsg(originalSSMsg: SSMessage, responseOp: SSMessage_Op): SSMessage {
    let responseSSMsg: SSMessage = {
        op: responseOp,
        key: originalSSMsg.key,
    };
    return responseSSMsg;
}

function sendACKSSMsg(ws: WebSocket, originalSSMsg: SSMessage) {
    sendSSMessage(ws, createResponseSSMsg(originalSSMsg, originalSSMsg.op));
}

function reportNode(ws: WebSocket, targetNodeID: string, reportCode: SSMessage_ReportCode) {
    let reportSSMessage: SSMessage = {
        op: SSMessage_Op.REPORT_NODE,
        key: "",
        reportNodeData: {
            nodeId: targetNodeID,
            reportCode: reportCode,
        },
    };
    sendSSMessage(ws, reportSSMessage);
}

export function reportNodeDisconnect(ws: WebSocket, targetNodeID: string) {
    reportNode(ws, targetNodeID, SSMessage_ReportCode.DISCONNECT_REPORT);
}