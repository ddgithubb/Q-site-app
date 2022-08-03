import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TIMEOUT_SECONDS, WSHOST } from "../config/http";
import { LwtSyncWSMessage, SyncWSMessage } from "./sync-server.model";
import { PoolClient } from "./pool-client";
import { Pool, PoolConnectionState } from "./pool.model";
import { store } from "../store/store";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";

export var ConnectedPools: Map<string, PoolClient> = new Map<string, PoolClient>();

declare global {
    interface Window { MainPoolClient: PoolClient; }
}

export function ConnectToPool(poolID: string, poolKey: number, connectIfNotExist: boolean = false): PoolClient {

    let p = ConnectedPools.get(poolID);
    if (p) {
        if (connectIfNotExist) {
            return p;
        };
        p.reconnect = false;
        p.ws.close();
    }

    store.dispatch(poolAction.updateConnectionState({
        key: poolKey,
        state: PoolConnectionState.CONNECTING,
    } as UpdateConnectionStateAction));

    var ws: WebSocket = new WebSocket(WSHOST + "?poolid=" + poolID);
    var wsMsg: SyncWSMessage;
    var heartbeatInterval: any = undefined;
    var heartbeatTimeout: any = undefined;
    var poolClient: PoolClient = new PoolClient(ws, poolKey);

    window.MainPoolClient = poolClient;

    ConnectedPools.set(poolID, poolClient);

    ws.onopen = () => {
        console.log("WS OPEN");
        store.dispatch(poolAction.updateConnectionState({
            key: poolKey,
            state: PoolConnectionState.CONNECTED,
        } as UpdateConnectionStateAction));
        heartbeatInterval = setInterval(() => {
            SendLwtSyncWSMessage(ws, 1000);
            heartbeatTimeout = setTimeout(() => {
                console.log("Heartbeat TIMEOUT");
                ConnectToPool(poolID, poolKey);
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
                ConnectToPool(poolID, poolKey);
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
            ConnectToPool(poolID, poolKey);
        } else {
            store.dispatch(poolAction.updateConnectionState({
                key: poolKey,
                state: PoolConnectionState.CLOSED,
            } as UpdateConnectionStateAction));
        }
    };
    ws.onerror = async (error: any) => {
        console.log("WS ERROR", error);
    };

    return poolClient;
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
