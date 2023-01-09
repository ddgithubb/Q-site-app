import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { Pool, PoolConnectionState, PoolDownloadProgressStatus, PoolInfo, PoolNode } from "../../pool/pool.model";
import { PoolMessage, PoolFileInfo, PoolFileOffer } from "../../pool/pool.v1";
import { PoolDeviceInfo, PoolUserInfo } from "../../pool/sync_server.v1";

export interface PoolsState {
    pools: Pool[];
}

const initialState: PoolsState = {
    pools: [],
}

export interface PoolAction {
    key: number;
}

export interface ResetPoolAction extends PoolAction {
}

export interface UpdateConnectionStateAction extends PoolAction {
    state: PoolConnectionState;
}

export interface UpdateUserAction extends PoolAction {
    userInfo: PoolUserInfo;
}

export interface RemoveUserAction extends PoolAction {
    userID: string;
}

export interface AddMessageAction extends PoolAction {
    message: PoolMessage;
}

export interface AddFileOfferAction extends PoolAction {
    fileOffer: PoolFileOffer;
}

export interface RemoveFileOfferAction extends PoolAction {
    fileID: string;
    nodeID: string;
} 

export interface AddActiveNodeAction extends PoolAction {
    node: PoolNode;
}

export interface RemoveActiveNodeAction extends PoolAction {
    nodeID: string;
}

export interface AddDownloadAction extends PoolAction {
    fileInfo: PoolFileInfo;
}

export interface updateDownloadSeederNodeIDAction extends PoolAction {
    fileID: string;
    seederNodeID: string;
}

export interface RemoveDownloadAction extends PoolAction {
    fileID: string;
}

const poolSlice = createSlice({
    name: "pool",
    initialState: initialState,
    reducers: {
        initPools(state: PoolsState, action: PayloadAction<PoolInfo[]>) {
            let poolsInfo = action.payload
            for (let i = 0; i < action.payload.length; i++) {
                state.pools.push({
                    poolID: poolsInfo[i].poolID,
                    poolName: poolsInfo[i].poolName,
                    users: poolsInfo[i].users,
                    poolSettings: poolsInfo[i].settings,
                    key: i,
                    connectionState: PoolConnectionState.CLOSED,
                    activeNodes: [],
                    downloadQueue: [],
                    messages: [],
                } as Pool)
            }
        },
        clearPool(state: PoolsState, action: PayloadAction<PoolAction>) {
            let pool = getPool(state, action);
            //pool.myNode = {} as PoolNode;
            pool.activeNodes = [];
            pool.downloadQueue = [];
            pool.messages = [];
        },
        resetPool(state: PoolsState, action: PayloadAction<ResetPoolAction>) {
            let pool = getPool(state, action);
            pool.activeNodes = [];
            pool.messages = [];

            // TEMP
            pool.users = [];
            // TEMP
        },
        updateConnectionState(state: PoolsState, action: PayloadAction<UpdateConnectionStateAction>) {
            let pool = getPool(state, action);
            pool.connectionState = action.payload.state;

            if (action.payload.state != PoolConnectionState.CONNECTED) {
                pool.activeNodes = [];
                // for (let i = 0; i < pool.Users.length; i++) {
                //     pool.Users[i].activeNodes = undefined;
                // }
            }
        },
        // updateActiveNodes(state: PoolsState, action: PayloadAction<UpdateActiveNodesAction>) {
        //     let pool = getPool(state, action);
        //     pool.activeNodes = action.payload.activeNodes;
        // },
        updateUser(state: PoolsState, action: PayloadAction<UpdateUserAction>) {
            let pool = getPool(state, action);
            let userInfo = action.payload.userInfo;
            let foundUser = false;
            for (const user of pool.users) {
                if (user.userId == userInfo.userId) {
                    user.displayName = userInfo.displayName;
                    user.devices = userInfo.devices;
                    foundUser = true;
                    break;
                }
            }
            if (!foundUser) {
                pool.users.push(userInfo);
            }
        },
        removeUser(state: PoolsState, action: PayloadAction<RemoveUserAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.users.length; i++) {
                if (pool.users[i].userId == action.payload.userID) {
                    pool.users.splice(i, 1);
                    break;
                }
            }
        },
        addMessage(state: PoolsState, action: PayloadAction<AddMessageAction>) {
            let pool = getPool(state, action);
            let msg: PoolMessage = action.payload.message;
            // msg.received = Date.now();
            //console.log("ADDING MESSAGE", msg, msg.created, pool.messages[0]?.created)
            if (pool.messages.length == 0) {
                pool.messages.push(msg);
                return;
            }
            for (let i = pool.messages.length; i >= 0; i--) {
                //console.log(pool.messages[i - 1].created, msg.created >= pool.messages[i - 1].created);
                if (i == 0 || msg.created >= pool.messages[i - 1].created) {
                    pool.messages.splice(i, 0, msg);
                    break;
                }
            }
            if (pool.messages.length > 1000) {
                pool.messages.shift();
            }
            // if (pool.messages.length > DEFAULT_MESSAGES_CACHE) {
            //     pool.messages.shift();
            // }
        },
        addActiveNode(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = getPool(state, action);
            pool.activeNodes.push(action.payload.node);
        },
        removeActiveNode(state: PoolsState, action: PayloadAction<RemoveActiveNodeAction>) {
            let pool = getPool(state, action);
            let userID = "";
            for (let i = 0; i < pool.activeNodes.length; i++) {
                if (pool.activeNodes[i].nodeID == action.payload.nodeID) {
                    userID = pool.activeNodes[i].userID;
                    pool.activeNodes.splice(i, 1);
                }
            }
        },
        addFileOffer(state: PoolsState, action: PayloadAction<AddFileOfferAction>) {
            let pool = getPool(state, action);
            if (!action.payload.fileOffer.fileInfo) return;
            for (const node of pool.activeNodes) {
                if (node.nodeID == action.payload.fileOffer.seederNodeId) {
                    node.fileOffersInfo.unshift(action.payload.fileOffer.fileInfo);
                    break;
                }
            }
        },
        removeFileOffer(state: PoolsState, action: PayloadAction<RemoveFileOfferAction>) {
            let pool = getPool(state, action);
            for (const node of pool.activeNodes) {
                if (node.nodeID == action.payload.nodeID) {
                    for (let i = 0; i < node.fileOffersInfo.length; i++) {
                        if (node.fileOffersInfo[i].fileId == action.payload.fileID) {
                            node.fileOffersInfo.splice(i, 1);
                        }
                    }
                    break;
                }
            }
        },
        clearFileOffers(state: PoolsState, action: PayloadAction<PoolAction>) {
            let pool = getPool(state, action);
            for (const node of pool.activeNodes) {
                node.fileOffersInfo = [];
            }
        },
        addDownload(state: PoolsState, action: PayloadAction<AddDownloadAction>) {
            let pool = getPool(state, action);
            pool.downloadQueue.push({ fileInfo: action.payload.fileInfo, seederNodeId: "" });
        },
        updateDownloadSeederNodeID(state: PoolsState, action: PayloadAction<updateDownloadSeederNodeIDAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileInfo!.fileId == action.payload.fileID) {
                    pool.downloadQueue[i].seederNodeId = action.payload.seederNodeID;
                    return;
                }
            }
        },
        removeDownload(state: PoolsState, action: PayloadAction<RemoveDownloadAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileInfo!.fileId == action.payload.fileID) {
                    pool.downloadQueue.splice(i, 1);
                    return;
                }
            }
        }
    }
});

function getPool(state: PoolsState, action: PayloadAction<PoolAction>): Pool {
    return state.pools[action.payload.key];
}

export const poolReducer = poolSlice.reducer;
export const poolAction = poolSlice.actions;

