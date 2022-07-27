import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TIMEOUT_SECONDS, WSHOST } from "../config/http";
import { LwtSyncWSMessage, SyncWSMessage } from "./sync-server.model";
import { PoolClient } from "./pool-client";
import { Pool } from "./pool.model";

export var ConnectedPools: Map<string, PoolClient> = new Map<string, PoolClient>();

declare global {
    interface Window { MainPoolClient: PoolClient; }
}

export function ConnectToPool(pool: Pool) {

    let poolID = pool.poolID

    let p = ConnectedPools.get(poolID);
    if (p) {
        p.reconnect = false;
        p.ws.close();
    }

    var ws: WebSocket = new WebSocket(WSHOST + "?poolid=" + poolID);
    var wsMsg: SyncWSMessage;
    var heartbeatInterval: any = undefined;
    var heartbeatTimeout: any = undefined;
    var poolClient: PoolClient = new PoolClient(pool, ws);

    window.MainPoolClient = poolClient;

    ConnectedPools.set(poolID, poolClient);

    ws.onopen = () => {
        console.log("WS OPEN");
        heartbeatInterval = setInterval(() => {
            SendLwtSyncWSMessage(ws, 1000);
            heartbeatTimeout = setTimeout(() => {
                console.log("Heartbeat TIMEOUT");
                ConnectToPool(pool);
            }, HEARTBEAT_TIMEOUT_SECONDS * 1000);
        }, HEARTBEAT_INTERVAL_SECONDS * 1000);
    };
    ws.onmessage = (event) => {

        console.log("WS MESSAGE", event.data);
        wsMsg = JSON.parse(event.data)

        if (wsMsg.Op >= 1000 && wsMsg.Op < 2000) {
            switch (wsMsg.Op) {
            case 1000:
                clearTimeout(heartbeatTimeout);
                break;
            }
        } else if (wsMsg.Op >= 2000 && wsMsg.Op < 3000) {
            handlePoolMessage(poolClient, wsMsg);
        } else if (wsMsg.Op >= 3000 && wsMsg.Op < 4000) {
            switch (wsMsg.Op) {
            case 3000:
                ConnectToPool(pool);
                break;
            }
        }
    }
    ws.onclose = (event) => {
        console.log("WS CLOSED", event);
        clearInterval(heartbeatInterval);
        clearTimeout(heartbeatTimeout);
        ConnectedPools.delete(poolID);
        poolClient.disconnectAllNodeConnections();
        if (poolClient.reconnect) {
            ConnectToPool(pool);
        }
    };
    ws.onerror = async (error: any) => {
        console.log("WS ERROR", error);
    };
}

export function SendLwtSyncWSMessage(ws: WebSocket, op: number, data?: any) {
    let msg: LwtSyncWSMessage = {
        Op: op,
        Data: data || null,
    }
    console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}

export function SendSyncWSMessage(ws: WebSocket, op: number, data?: any, prevWSMsg?: SyncWSMessage, targetNodeID?: string, key?: string) {
    let msg: SyncWSMessage = {
        Op: op,
        Key: prevWSMsg?.Key || key || "",
        TargetNodeID: prevWSMsg?.TargetNodeID || targetNodeID || "",
        Data: data || null,
    }
    console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}

function handlePoolMessage(pool: PoolClient, msg: SyncWSMessage) {
    switch (msg.Op) {
    case 2000:
        pool.updateNodePosition(msg);
        break;
    case 2001:
        pool.sendOffer(msg);
        break;
    case 2002:
        pool.disconnectNode(msg);
        break;
    case 2003:
        pool.answerOffer(msg);
        break;
    case 2004:
        pool.finalizeConnectNode(msg);
        break;
    case 2005:
        pool.verifyConnection(msg);
        break;
    }
}
