import { WSHOST, HEARTBEAT_TIMEOUT_SECONDS, HEARTBEAT_INTERVAL_SECONDS } from "../config/http";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";
import { store } from "../store/store";
import { PoolManager } from "./global";
import { PoolClient } from "./pool-client";
import { PoolConnectionState } from "./pool.model";
import { SSLwtMessage, SSMessage, SSNodeStatusData, SSSDPData, SSStatus } from "./sync-server.model";

export function initializePool(poolID: string, poolKey: number): PoolClient {
    var wsMsg: SSMessage;
    var heartbeatInterval: any = undefined;
    var heartbeatTimeout: any = undefined;
    var ws: WebSocket = new WebSocket(WSHOST + "?poolid=" + poolID);
    var poolClient: PoolClient = new PoolClient(poolID, poolKey, ws);

    window.MainPoolClient = poolClient;

    ws.onopen = () => {
        console.log("WS OPEN");
        store.dispatch(poolAction.updateConnectionState({ // TEMP (shouild be controlled by poolClient)
            key: poolKey,
            state: PoolConnectionState.CONNECTED,
        } as UpdateConnectionStateAction));
        heartbeatInterval = setInterval(() => {
            SendSSLwtMessage(ws, 1000);
            heartbeatTimeout = setTimeout(() => {
                console.log("Heartbeat TIMEOUT");
                PoolManager.reconnectToPool(poolID, poolKey);
            }, HEARTBEAT_TIMEOUT_SECONDS * 1000);
        }, HEARTBEAT_INTERVAL_SECONDS * 1000);
    };
    ws.onmessage = (event) => {
        //console.log("WS MESSAGE", event.data);
        wsMsg = JSON.parse(event.data)

        if (wsMsg.Op >= 1000 && wsMsg.Op < 2000) {
            switch (wsMsg.Op) {
            case 1000:
                clearTimeout(heartbeatTimeout);
                break;
            }
        } else if (wsMsg.Op >= 2000 && wsMsg.Op < 3000) {
            handleSSMessage(poolClient, wsMsg);
        } else if (wsMsg.Op >= 3000 && wsMsg.Op < 4000) {
            switch (wsMsg.Op) {
            case 3000:
                PoolManager.reconnectToPool(poolID, poolKey);
                break;
            }
        }
    }
    ws.onclose = (event) => {
        console.log("WS CLOSED", event);
        clearInterval(heartbeatInterval);
        clearTimeout(heartbeatTimeout);
        poolClient.clean();
        if (poolClient.reconnect) {
            PoolManager.reconnectToPool(poolID, poolKey);
        }
    };
    ws.onerror = async (error: any) => {
        console.log("WS ERROR", error);
    };

    return poolClient;
}

function handleSSMessage(pool: PoolClient, msg: SSMessage) {
    switch (msg.Op) {
    case 2000:
        pool.updateNodePosition(msg.Data, msg.TargetNodeID)
        SendSSMessage(pool.ws, 2000, undefined, msg);
        break;
    case 2001:
        pool.getOffer(msg.TargetNodeID).then((sdp) => {
            SendSSMessage(pool.ws, 2003, { SDP: sdp, Status: SSStatus.SUCCESSFUL } as SSSDPData, msg);
        }).catch(() => {
            SendSSMessage(pool.ws, 2003, { SDP: "", Status: SSStatus.UNSUCCESSFUL } as SSSDPData, msg)
        });
        break;
    case 2002:
        pool.disconnectNode(msg.TargetNodeID, msg.Data)
        SendSSMessage(pool.ws, 2002, undefined, msg);
        break;
    case 2003:
        pool.answerOffer(msg.TargetNodeID, msg.Data).then((sdp) => {
            SendSSMessage(pool.ws, 2004, { SDP: sdp, Status: SSStatus.SUCCESSFUL } as SSSDPData, msg);
        }).catch(() => {
            SendSSMessage(pool.ws, 2004, { SDP: "", Status: SSStatus.UNSUCCESSFUL } as SSSDPData, msg)
        });
        break;
    case 2004:
        pool.connectNode(msg.TargetNodeID, msg.Data).then(() => {
            SendSSMessage(pool.ws, 2001, { Status: SSStatus.SUCCESSFUL } as SSNodeStatusData, msg)
        }).catch(() => {
            SendSSMessage(pool.ws, 2001, { Status: SSStatus.UNSUCCESSFUL } as SSNodeStatusData, msg);
        });
        break;
    case 2005:
        if (pool.verifyConnection(msg)) {
            SendSSMessage(pool.ws, 2005, { Status: SSStatus.SUCCESSFUL } as SSNodeStatusData, msg);
        } else {
            SendSSMessage(pool.ws, 2005, { Status: SSStatus.UNSUCCESSFUL } as SSNodeStatusData, msg);
        }
        break;
    }
}

export function SendSSLwtMessage(ws: WebSocket, op: number, data?: any) {
    let msg: SSLwtMessage = {
        Op: op,
        Data: data || null,
    }
    //console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}

export function SendSSMessage(ws: WebSocket, op: number, data?: any, prevWSMsg?: SSMessage, targetNodeID?: string, key?: string) {
    let msg: SSMessage = {
        Op: op,
        Key: prevWSMsg?.Key || key || "",
        TargetNodeID: prevWSMsg?.TargetNodeID || targetNodeID || "",
        Data: data || null,
    }
    //console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}