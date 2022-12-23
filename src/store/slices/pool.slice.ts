import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { PoolNodeState, Pool, PoolInfo, PoolUpdateLatestInfo, PoolMessagePackage, PoolMessageType, PoolNode, PoolMessageInfo, PoolConnectionState, PoolUser, PoolFileInfo, isMediaType, PoolFileProgress, PoolDownloadProgressStatus, PoolMessage, PoolNodeInfo, PoolDevice, PoolFileOffer, PoolFileOfferAndSeeders } from "../../pool/pool.model";

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
    nodeInfo: PoolNodeInfo;
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

// export interface UpdateActiveNodesAction extends PoolAction {
//     activeNodes: PoolNode[];
// }

export interface AddDownloadAction extends PoolAction {
    fileInfo: PoolFileInfo;
}

export interface UpdateDownloadProgressAction extends PoolAction {
    fileID: string;
    progress: number;
}

export interface UpdateDownloadProgressStatusAction extends PoolAction {
    fileID: string;
    seederNodeID: string;
    status: PoolDownloadProgressStatus;
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
            //pool.myNode = {} as PoolNode;
            pool.activeNodes = [];
            pool.downloadQueue = [];
            pool.messages = [];
        },
        resetPool(state: PoolsState, action: PayloadAction<ResetPoolAction>) {
            let pool = getPool(state, action);
            //pool.myNode = action.payload.node;
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
        // updateActiveNodes(state: PoolsState, action: PayloadAction<UpdateActiveNodesAction>) {
        //     let pool = getPool(state, action);
        //     pool.activeNodes = action.payload.activeNodes;
        // },
        updateUser(state: PoolsState, action: PayloadAction<UpdateUserAction>) {
            let pool = getPool(state, action);
            let nodeInfo = action.payload.nodeInfo;
            let foundUser = false;
            for (const user of pool.Users) {
                if (user.UserID == nodeInfo.UserID) {
                    user.DisplayName = nodeInfo.DisplayName;
                    let foundDevice = false;
                    for (const device of user.Devices) {
                        if (device.DeviceID == nodeInfo.DeviceID) {
                            device.DeviceName = nodeInfo.DeviceName;
                            device.DeviceType = nodeInfo.DeviceType;
                            foundDevice = true;
                            break;
                        }
                    }
                    if (!foundDevice) {
                        let device: PoolDevice = {
                            DeviceID: nodeInfo.DeviceID,
                            DeviceType: nodeInfo.DeviceType,
                            DeviceName: nodeInfo.DeviceName,
                        }
                        user.Devices.push(device);
                    }
                    foundUser = true;
                    break;
                }
            }
            if (!foundUser) {
                let user: PoolUser = {
                    UserID: nodeInfo.UserID,
                    DisplayName: nodeInfo.DisplayName,
                    Devices: [{
                        DeviceID: nodeInfo.DeviceID,
                        DeviceType: nodeInfo.DeviceType,
                        DeviceName: nodeInfo.DeviceName,
                    }],
                }
                pool.Users.push(user);
            }
        },
        removeUser(state: PoolsState, action: PayloadAction<RemoveUserAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.Users.length; i++) {
                if (pool.Users[i].UserID == action.payload.userID) {
                    pool.Users.splice(i, 1);
                    break;
                }
            }
        },
        addMessage(state: PoolsState, action: PayloadAction<AddMessageAction>) {
            let pool = getPool(state, action);
            let msg: PoolMessage = action.payload.message;
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
            // if (pool.messages.length > DEFAULT_MESSAGES_CACHE) {
            //     pool.messages.shift();
            // }
        },
        addActiveNode(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = getPool(state, action);
            // if (action.payload.myNode) {
            //     pool.myNode = action.payload.node;
            // }
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
            // if (action.payload.fileOffer.nodeID == pool.myNode.nodeID) {
            //     pool.myNode.fileOffers.unshift(action.payload.fileOffer);
            // }
            for (const node of pool.activeNodes) {
                if (node.nodeID == action.payload.fileOffer.seederNodeID) {
                    node.fileOffers.unshift(action.payload.fileOffer);
                    break;
                }
            }
        },
        removeFileOffer(state: PoolsState, action: PayloadAction<RemoveFileOfferAction>) {
            let pool = getPool(state, action);
            // if (action.payload.nodeID == pool.myNode.nodeID) {
            //     for (let i = 0; i < pool.myNode.fileOffers.length; i++) {
            //         if (pool.myNode.fileOffers[i].fileID == action.payload.fileID) {
            //             pool.myNode.fileOffers.splice(i, 1);
            //         }
            //     }
            // }
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
        clearFileOffers(state: PoolsState, action: PayloadAction<PoolAction>) {
            let pool = getPool(state, action);
            for (const node of pool.activeNodes) {
                node.fileOffers = [];
            }
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
                fileOffer: { ...action.payload.fileInfo, seederNodeID: "" },
                progress: 0,
                status: PoolDownloadProgressStatus.DOWNLOADING,
            };
            pool.downloadQueue.push(poolFileProgress);
        },
        updateDownloadProgress(state: PoolsState, action: PayloadAction<UpdateDownloadProgressAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileOffer.fileID == action.payload.fileID) {
                    pool.downloadQueue[i].progress = action.payload.progress;
                    return;
                }
            }
        },
        updateDownloadProgressStatus(state: PoolsState, action: PayloadAction<UpdateDownloadProgressStatusAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileOffer.fileID == action.payload.fileID) {
                    pool.downloadQueue[i].fileOffer.seederNodeID = action.payload.seederNodeID;
                    pool.downloadQueue[i].status = action.payload.status;
                    return;
                }
            }
        },
        removeDownload(state: PoolsState, action: PayloadAction<RemoveDownloadAction>) {
            let pool = getPool(state, action);
            for (let i = 0; i < pool.downloadQueue.length; i++) {
                if (pool.downloadQueue[i].fileOffer.fileID == action.payload.fileID) {
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

