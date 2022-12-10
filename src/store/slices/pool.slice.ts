import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { PoolNodeState, Pool, PoolInfo, PoolUpdateLatestInfo, PoolMessage, PoolMessageType, PoolNode, PoolMessageInfo, PoolConnectionState, PoolUser, PoolFileInfo, isMediaType, PoolFileProgress, PoolDownloadProgressStatus, PoolMessageView } from "../../pool/pool.model";

export interface PoolsState {
    pools: Pool[];
}

const initialState: PoolsState = {
    pools: [],
}

export interface PoolAction {
    key: number;
}

export interface UpdateConnectionStateAction extends PoolAction {
    state: PoolConnectionState;
}

export interface AddMessageAction extends PoolAction {
    message: PoolMessageView;
}

export interface AddFileOfferAction extends PoolAction {
    fileOffer: PoolFileInfo;
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

export interface UpdateActiveNodesAction extends PoolAction {
    activeNodes: PoolNode[];
}

export interface AddDownloadAction extends PoolAction {
    fileInfo: PoolFileInfo;
}

export interface UpdateDownloadProgressAction extends PoolAction {
    fileID: string;
    progress: number;
}

export interface UpdateDownloadProgressStatusAction extends PoolAction {
    fileID: string;
    status: PoolDownloadProgressStatus;
}

export interface RemoveDownloadAction extends PoolAction {
    fileID: string;
}

export interface SetMediaURLAction extends PoolAction {
    fileID: string;
    mediaURL: string;
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
        clearPool(state: PoolsState, action: PayloadAction<PoolAction>) {
            let pool = getPool(state, action);
            pool.myNode = {} as PoolNode;
            pool.activeNodes = [];
            pool.downloadQueue = [];
            pool.messages = [];
        },
        resetPool(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = getPool(state, action);
            pool.myNode = action.payload.node;
            pool.activeNodes = [];
            // pool.downloadQueue = [];
            pool.messages = [];
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
        updateActiveNodes(state: PoolsState, action: PayloadAction<UpdateActiveNodesAction>) {
            let pool = getPool(state, action);
            pool.activeNodes = action.payload.activeNodes;
        },
        addMessage(state: PoolsState, action: PayloadAction<AddMessageAction>) {
            let pool = getPool(state, action);
            let msg: PoolMessageView = action.payload.message;
            //console.log("ADDING MESSAGE", msg, pool.messages[0]?.created)
            if (pool.messages.length == 0) {
                pool.messages.push(msg);
                return;
            }
            for (let i = pool.messages.length; i >= 0; i--) {
                if (i == 0 || msg.created >= pool.messages[i - 1].created) {
                    pool.messages.splice(i + 1, 0, msg);
                    break;
                }
            }
            // if (pool.messages.length > DEFAULT_MESSAGES_CACHE) {
            //     pool.messages.shift();
            // }
        },
        addFileOffer(state: PoolsState, action: PayloadAction<AddFileOfferAction>) {
            let pool = getPool(state, action);
            if (action.payload.fileOffer.nodeID == pool.myNode.nodeID) {
                pool.myNode.fileOffers.unshift(action.payload.fileOffer);
            }
            for (const node of pool.activeNodes) {
                if (node.nodeID == action.payload.fileOffer.nodeID) {
                    node.fileOffers.unshift(action.payload.fileOffer);
                    break;
                }
            }
        },
        removeFileOffer(state: PoolsState, action: PayloadAction<RemoveFileOfferAction>) {
            let pool = getPool(state, action);
            if (action.payload.nodeID == pool.myNode.nodeID) {
                for (let i = 0; i < pool.myNode.fileOffers.length; i++) {
                    if (pool.myNode.fileOffers[i].fileID == action.payload.fileID) {
                        pool.myNode.fileOffers.splice(i, 1);
                    }
                }
            }
            for (const node of pool.activeNodes) {
                if (node.nodeID == action.payload.nodeID) {
                    for (let i = 0; i < node.fileOffers.length; i++) {
                        if (node.fileOffers[i].fileID == action.payload.fileID) {
                            node.fileOffers.splice(i, 1);
                        }
                    }
                    break;
                }
            }
        },
        addActiveNode(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = getPool(state, action);
            pool.activeNodes.push(action.payload.node);
            // for (let i = 0; i < pool.Users.length; i++) {
            //     if (pool.Users[i].UserID == action.payload.node.userID) {
            //         if (pool.Users[i].activeNodes == undefined) {
            //             pool.Users[i].activeNodes = [action.payload.node];
            //             let tempUser = pool.Users[i];
            //             pool.Users.splice(i, 1);
            //             pool.Users.unshift(tempUser);
            //         } else {
            //             pool.Users[i].activeNodes?.push(action.payload.node);
            //         }
            //         break;
            //     }
            //}
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

            // if (userID != "") {
            //     for (let i = 0; i < pool.Users.length; i++) {
            //         if (pool.Users[i].UserID == userID) {
            //             if (!pool.Users[i].activeNodes) break;
            //             for (let j = 0; j < pool.Users[i].activeNodes!.length; j++) {
            //                 if (pool.Users[i].activeNodes![j].nodeID == action.payload.nodeID) {
            //                     pool.Users[i].activeNodes!.splice(j, 1);
            //                     if (pool.Users[i].activeNodes?.length == 0) {
            //                         pool.Users[i].activeNodes = undefined;
            //                         let tempUser = pool.Users[i];
            //                         pool.Users.splice(i, 1);
            //                         let found = false;
            //                         for (let i = pool.Users.length - 1; i >= 0; i--) {
            //                             if (pool.Users[i].activeNodes || tempUser.DisplayName >= pool.Users[i].DisplayName) {
            //                                 pool.Users.splice(i + 1, 0, tempUser);
            //                                 found = true;
            //                                 break;
            //                             }
            //                         }
            //                         if (!found) pool.Users.unshift(tempUser);
            //                         break;
            //                     }
            //                 }
            //             }
            //             break;
            //         }
            //     }
            // }
        },
        addDownload(state: PoolsState, action: PayloadAction<AddDownloadAction>) {
            let pool = getPool(state, action);
            // for (let i = 0; i < pool.downloadQueue.length; i++) {
            //     if (pool.downloadQueue[i].fileID == action.payload.fileInfo.fileID) {
            //         pool.downloadQueue[i].progress = 0;
            //         pool.downloadQueue[i].status = PoolDownloadProgressStatus.DOWNLOADING;
            //         return;
            //     }
            // }
            let poolFileProgress: PoolFileProgress = {
                ...action.payload.fileInfo,
                progress: 0,
                status: PoolDownloadProgressStatus.DOWNLOADING,
            };
            pool.downloadQueue.push(poolFileProgress);
        },
        updateDownloadProgress(state: PoolsState, action: PayloadAction<UpdateDownloadProgressAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileID == action.payload.fileID) {
                    pool.downloadQueue[i].progress = action.payload.progress;
                    return;
                }
            }
        },
        updateDownloadProgressStatus(state: PoolsState, action: PayloadAction<UpdateDownloadProgressStatusAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileID == action.payload.fileID) {
                    pool.downloadQueue[i].status = action.payload.status;
                    return;
                }
            }
        },
        removeDownload(state: PoolsState, action: PayloadAction<RemoveDownloadAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileID == action.payload.fileID) {
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

