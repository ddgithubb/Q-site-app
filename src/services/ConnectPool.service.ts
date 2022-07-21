import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TIMEOUT_SECONDS, WSHOST } from "../config/http";
import { NodeConnection, NodePosition, Pool } from "../models/Pool.model";
import { NodeStatusData, Status, WSMessage } from "../models/SyncServerWS.model";
import { AnswerOffer, CloseNodeConnection, ConnectNode, SendOffer } from "./ConnectNode.service";

var heartbeatInterval: any = undefined;
var heartbeatTimeout: any = undefined;
var wsMsg: WSMessage;

var connectedPools: Map<string, Pool> = new Map<string, Pool>();

export function ConnectToPool(poolID: string) {

    let p = connectedPools.get(poolID);
    if (p) {
        p.reconnect = false;
        p.wsConn.close();
    }

    var ws: WebSocket = new WebSocket(WSHOST);

    var pool: Pool = {
        poolID: poolID,
        wsConn: ws,
        nodePosition: <NodePosition>{},
        nodeConnections: new Map<string, NodeConnection>(),
        reconnect: true,
    };

    connectedPools.set(poolID, pool);

    ws.onopen = () => {
        console.log("OPEN");
        heartbeatInterval = setInterval(() => {
            SendWSMessage(ws, 1000);
            heartbeatTimeout = setTimeout(() => {
                console.log("Heartbeat TIMEOUT");
                ConnectToPool(poolID);
            }, HEARTBEAT_TIMEOUT_SECONDS * 1000);
        }, HEARTBEAT_INTERVAL_SECONDS * 1000);
    };
    ws.onmessage = (event) => {

        console.log("MESSAGE", event.data);
        wsMsg = JSON.parse(event.data)

        if (wsMsg.Op >= 1000 && wsMsg.Op < 2000) {
            switch (wsMsg.Op) {
            case 1000:
                clearTimeout(heartbeatTimeout);
                break;
            }
        } else if (wsMsg.Op >= 2000 && wsMsg.Op < 3000) {
            handleMessage(pool, wsMsg);
        } else if (wsMsg.Op >= 3000 && wsMsg.Op < 4000) {
            switch (wsMsg.Op) {
            case 3000:
                ConnectToPool(poolID);
                break;
            }
        }
    }
    ws.onclose = (event) => {
        console.log("CLOSED", event);
        clearInterval(heartbeatInterval);
        clearTimeout(heartbeatTimeout);
        connectedPools.delete(poolID);
        pool.nodeConnections.forEach((nodeConn) => {
            CloseNodeConnection(nodeConn)
        })
        if (pool.reconnect) {
            ConnectToPool(poolID);
        }
    };
    ws.onerror = async (error: any) => {
        console.log("ERROR", error);
    };
}

export function SendWSMessage(ws: WebSocket, op: number, data?: any, prevWSMsg?: WSMessage) {
    let msg: WSMessage = {
        Op: op,
        Key: prevWSMsg?.Key || "",
        TargetNodeID: prevWSMsg?.TargetNodeID || "",
        Data: data,
    }
    console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}

function handleMessage(pool: Pool, msg: WSMessage) {
    let nodeConnection: NodeConnection | undefined;
    switch (msg.Op) {
    case 2000:
        pool.nodePosition = msg.Data;
        break;
    case 2001:
        SendOffer(pool, msg);
        break;
    case 2002:
        nodeConnection = pool.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection) break;
        CloseNodeConnection(nodeConnection);
        pool.nodeConnections.delete(msg.TargetNodeID);
        break;
    case 2003:
        AnswerOffer(pool, msg);
        break;
    case 2004:
        ConnectNode(pool, msg);
        break;
    case 2005:
        nodeConnection = pool.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            SendWSMessage(pool.wsConn, 2005, <NodeStatusData>{ Status: Status.UNSUCCESSFUL }, wsMsg);
            break;
        }
        SendWSMessage(pool.wsConn, 2005, <NodeStatusData>{ Status: Status.SUCCESSFUL }, wsMsg);
        break;
    }
}
