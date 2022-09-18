import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { PoolNodeState, Pool, PoolInfo, PoolUpdateLatestInfo, PoolMessage, PoolMessageType, PoolNode, PoolMessageInfo, PoolConnectionState, PoolUser, PoolFileInfo } from "../../pool/pool.model";

export interface PoolsState {
    pools: Pool[];
}

const initialState: PoolsState = {
    pools: [],
}

export interface ExecPoolAction {
    key: number;
}

export interface UpdateConnectionStateAction {
    key: number;
    state: PoolConnectionState;
}

export interface AddMessageAction {
    key: number;
    message: PoolMessage
}

export interface AddActiveNodeAction {
    key: number;
    node: PoolNode;
}

export interface RemoveActiveNodeAction {
    key: number;
    nodeID: string;
}

export interface UpdateActiveNodesAction {
    key: number;
    activeNodes: PoolNode[];
}

export interface AddDownloadAction {
    key: number;
    fileInfo: PoolFileInfo
}

export interface UpdateDownloadProgressAction {
    key: number;
    fileID: string;
    progress: number;
}

export interface RemoveDownloadAction {
    key: number;
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
                    PoolID: poolsInfo[i].PoolID,
                    PoolName: poolsInfo[i].PoolName,
                    Users: poolsInfo[i].Users,
                    PoolSettings: poolsInfo[i].Settings,
                    key: i,
                    connectionState: PoolConnectionState.CLOSED,
                    myNode: {} as PoolNode,
                    activeNodes: [],
                    downloadQueue: [],
                    messages: [],
                } as Pool)
            }
        },
        clearPool(state: PoolsState, action: PayloadAction<ExecPoolAction>) {
            let pool = state.pools[action.payload.key];
            pool.myNode = {} as PoolNode;
            pool.activeNodes = [];
            pool.downloadQueue = [];
            pool.messages = [];
        },
        resetPool(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            pool.myNode = action.payload.node;
            pool.activeNodes = [];
            // pool.downloadQueue = [];
            pool.messages = [];
        },
        updateConnectionState(state: PoolsState, action: PayloadAction<UpdateConnectionStateAction>) {
            let pool = state.pools[action.payload.key];
            pool.connectionState = action.payload.state;

            if (action.payload.state != PoolConnectionState.CONNECTED) {
                pool.activeNodes = [];
                for (let i = 0; i < pool.Users.length; i++) {
                    pool.Users[i].activeNodes = undefined;
                }
            }
        },
        updateActiveNodes(state: PoolsState, action: PayloadAction<UpdateActiveNodesAction>) {
            let pool = state.pools[action.payload.key];
            pool.activeNodes = action.payload.activeNodes;
            for (let i = pool.activeNodes.length - 1; i >= 0; i--) {
                if (pool.activeNodes[i].nodeID == pool.myNode.nodeID) {
                    pool.activeNodes.splice(i, 1);
                    break;
                }
            }
        },
        // updateLatest(state: PoolsState, action: PayloadAction<UpdateLatestAction>) {
        //     let pool = state.pools[action.payload.key];
        //     if (!action.payload.latest.messagesOnly) {
        //         pool.activeNodes = action.payload.latest.activeNodes;
        //         for (let i = pool.activeNodes.length - 1; i >= 0; i--) {
        //             if (pool.activeNodes[i].nodeID == pool.myNode.nodeID) {
        //                 pool.activeNodes.splice(i, 1);
        //                 break;
        //             }
        //         }
        //     }
        //     if (action.payload.latest.lastMessageID == "") {
        //         pool.messages = action.payload.latest.messages;
        //     }
        //     // else if (action.payload.latest.messages.length > 0) {
        //     //     let i = pool.messages.length - 1;
        //     //     for (; i >= 0; i--) {
        //     //         if (pool.messages[i].msgID == action.payload.latest.lastMessageID) {
        //     //             break;
        //     //         }
        //     //     }
        //     //     if (i == -1) {
        //     //         pool.messages = action.payload.latest.messages;
        //     //     } else if ((pool.messages.length - 1 - i) < action.payload.latest.messages.length) {
        //     //         pool.messages.splice(i + 1);
        //     //         pool.messages.push(...action.payload.latest.messages);
        //     //     }
        //     // }
        // },
        addMessage(state: PoolsState, action: PayloadAction<AddMessageAction>) {
            let pool = state.pools[action.payload.key];
            let msg: PoolMessage = action.payload.message;
            msg.received = Date.now();
            pool.messages.push(msg);
            if (pool.messages.length > DEFAULT_MESSAGES_CACHE) {
                pool.messages.shift();
            }

            if (action.payload.message.type == PoolMessageType.FILE) {
                let fileOffer: PoolFileInfo = action.payload.message.data;
                if (action.payload.message.src.nodeID == pool.myNode.nodeID) {
                    pool.myNode.fileOffers.unshift(fileOffer);
                } else {
                    for (const node of pool.activeNodes) {
                        if (node.nodeID == action.payload.message.src.nodeID) {
                            node.fileOffers.unshift(fileOffer);
                            break;
                        }
                    }
                }
            }
        },
        addActiveNode(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            pool.activeNodes.push(action.payload.node);

            for (let i = 0; i < pool.Users.length; i++) {
                if (pool.Users[i].UserID == action.payload.node.userID) {
                    if (!pool.Users[i].activeNodes) pool.Users[i].activeNodes = [];
                    pool.Users[i].activeNodes?.push(action.payload.node);
                    break;
                }
            }
        },
        removeActiveNode(state: PoolsState, action: PayloadAction<RemoveActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            let userID = "";
            for (let i = 0; i < pool.activeNodes.length; i++) {
                if (pool.activeNodes[i].nodeID == action.payload.nodeID) {
                    userID = pool.activeNodes[i].userID;
                    pool.activeNodes.splice(i, 1);
                }
            }

            if (userID != "") {
                for (let i = 0; i < pool.Users.length; i++) {
                    if (pool.Users[i].UserID == userID) {
                        if (!pool.Users[i].activeNodes) break;
                        for (let j = 0; j < pool.Users[i].activeNodes!.length; j++) {
                            if (pool.Users[i].activeNodes![j].nodeID == action.payload.nodeID) {
                                pool.Users[i].activeNodes!.splice(j, 1);
                            }
                        }
                        break;
                    }
                }
            }
        },
        addDownload(state: PoolsState, action: PayloadAction<AddDownloadAction>) {
            state.pools[action.payload.key].downloadQueue.push(action.payload.fileInfo);
        },
        updateDownloadProgress(state: PoolsState, action: PayloadAction<UpdateDownloadProgressAction>) {
            let pool = state.pools[action.payload.key];
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileID == action.payload.fileID) {
                    pool.downloadQueue[i].downloadProgress = action.payload.progress;
                }
            }
        },
        removeDownload(state: PoolsState, action: PayloadAction<RemoveDownloadAction>) {
            let pool = state.pools[action.payload.key];
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileID == action.payload.fileID) {
                    pool.downloadQueue.splice(i, 1);
                    return;
                }
            }
        }
    }
});

export const poolReducer = poolSlice.reducer;
export const poolAction = poolSlice.actions;

