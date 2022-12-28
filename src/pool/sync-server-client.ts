import { SYNC_SERVER_CONNECT_ENDPOINT, HEARTBEAT_TIMEOUT_SECONDS, HEARTBEAT_INTERVAL_SECONDS } from "../config/http";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";
import { getStoreState, store } from "../store/store";
import { validateSSState } from "../views/static/MaintenancePage";
import { PoolManager } from "./global";
import { PoolClient } from "./pool-client";
import { PoolConnectionState } from "./pool.model";
import { SSLwtMessage, SSMessage, SSNodeStatusData, SSSDPData, SSStatus } from "./sync-server.model";

export function initializePool(poolID: string, poolKey: number): PoolClient {
    var wsMsg: SSMessage;
    var heartbeatInterval: any = undefined;
    var heartbeatTimeout: any = undefined;
    var ws: WebSocket = new WebSocket(SYNC_SERVER_CONNECT_ENDPOINT + "?poolid=" + poolID + "&displayname=" + getStoreState().profile.displayName);
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
        console.log("WS RECV", event.data);
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

function handleSSMessage(pool: PoolClient, msg: SSMessage) {
    switch (msg.Op) {
    case 2000:
        pool.updateNodePosition(msg.Data, msg.TargetNodeID)
        SendSSMessage(pool.ws, 2000, undefined, msg);
        break;
    case 2001:
        //console.warn(msg.Key, "2001 START", msg.TargetNodeID);
        pool.getOffer(msg.TargetNodeID).then((sdp) => {
            SendSSMessage(pool.ws, 2003, { SDP: sdp, Status: SSStatus.SUCCESSFUL } as SSSDPData, msg);
            //console.warn(msg.Key, "2001 SUCCESS");
        }).catch(() => {
            SendSSMessage(pool.ws, 2003, { SDP: "", Status: SSStatus.UNSUCCESSFUL } as SSSDPData, msg)
            //console.warn(msg.Key, "2001 FAIL");
        });
        break;
    case 2002:
        //console.log("DISCONNECT NODE", msg.TargetNodeID);
        pool.disconnectNode(msg.TargetNodeID)
        SendSSMessage(pool.ws, 2002, undefined, msg);
        break;
    case 2003:
        //console.warn(msg.Key, "2003 START", msg.TargetNodeID);
        pool.answerOffer(msg.TargetNodeID, msg.Data).then((sdp) => {
            SendSSMessage(pool.ws, 2004, { SDP: sdp, Status: SSStatus.SUCCESSFUL } as SSSDPData, msg);
            //console.warn(msg.Key, "2003 SUCCESS");
        }).catch(() => {
            SendSSMessage(pool.ws, 2004, { SDP: "", Status: SSStatus.UNSUCCESSFUL } as SSSDPData, msg);
            //console.warn(msg.Key, "2003 FAIL");
        });
        break;
    case 2004:
        //console.warn(msg.Key, "2004 START", msg.TargetNodeID);
        pool.connectNode(msg.TargetNodeID, msg.Data).then(() => {
            SendSSMessage(pool.ws, 2001, { Status: SSStatus.SUCCESSFUL } as SSNodeStatusData, msg);
            //console.warn(msg.Key, "2004 SUCCESS");
        }).catch(() => {
            SendSSMessage(pool.ws, 2001, { Status: SSStatus.UNSUCCESSFUL } as SSNodeStatusData, msg);
            //console.warn(msg.Key, "2004 FAIL");
        });
        break;
    case 2005:
        if (pool.verifyConnection(msg.TargetNodeID)) {
            SendSSMessage(pool.ws, 2005, { Status: SSStatus.SUCCESSFUL } as SSNodeStatusData, msg);
        } else {
            SendSSMessage(pool.ws, 2005, { Status: SSStatus.UNSUCCESSFUL } as SSNodeStatusData, msg);
        }
        break;
    case 2010:
        pool.addNodes(msg.Data);
        SendSSMessage(pool.ws, 2010, undefined, msg);
        break;
    case 2011:
        pool.removeNode(msg.Data);
        SendSSMessage(pool.ws, 2011, undefined, msg);
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
    console.log("WS SEND:", JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
}