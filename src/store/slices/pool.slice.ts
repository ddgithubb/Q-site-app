import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { NodeState, Pool, PoolInfo, PoolUpdateLatest, PoolMessage, PoolMessageType, PoolNode, PoolMessageInfo } from "../../pool/pool.model";

export interface PoolsState {
    pools: Pool[];
}

const initialState: PoolsState = {
    pools: [],
}

export interface AddMessageAction {
    key: number;
    message: PoolMessage
}

export interface ReceivedMessageAction {
    key: number;
    msgID: string;
}

export interface AddActiveNodeAction {
    key: number;
    node: PoolNode;
}

export interface RemoveActiveNodeAction {
    key: number;
    nodeID: string;
}

export interface UpdateLatestAction {
    key: number;
    latest: PoolUpdateLatest
}

const poolSlice = createSlice({
    name: "pool",
    initialState: initialState,
    reducers: {
        initPools(state: PoolsState, action: PayloadAction<PoolInfo[]>) {
            for (const poolInfo of action.payload) {
                state.pools.push({
                    poolID: poolInfo.PoolID,
                    users: poolInfo.Users,
                    key: poolInfo.Key,
                    myNode: {} as PoolNode,
                    activeNodes: [],
                    messages: [],
                    receivedMessages: [],
                } as Pool)
            }
        },
        resetPool(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            pool.activeNodes = [];
            pool.receivedMessages = [];
            pool.myNode = action.payload.node;
        },
        updateLatest(state: PoolsState, action: PayloadAction<UpdateLatestAction>) {
            let pool = state.pools[action.payload.key];
            pool.activeNodes = action.payload.latest.activeNodes;
            pool.messages = action.payload.latest.messages;
            for (let i = pool.activeNodes.length - 1; i >= 0; i--) {
                if (pool.activeNodes[i].nodeID == pool.myNode.nodeID) {
                    pool.activeNodes.splice(i, 1);
                    return;
                }
            }
        },
        addMessage(state: PoolsState, action: PayloadAction<AddMessageAction>) {
            let pool = state.pools[action.payload.key];
            let msg: PoolMessage = action.payload.message;
            msg.received = Date.now();
            pool.messages.push(msg);
            if (pool.messages.length > DEFAULT_MESSAGES_CACHE) {
                pool.messages.shift();
            }
        },
        receivedMessage(state: PoolsState, action: PayloadAction<ReceivedMessageAction>) {
            let pool = state.pools[action.payload.key];
            let msg: PoolMessageInfo = {
                msgID: action.payload.msgID,
                received: Date.now(),
            };
            pool.receivedMessages.push(msg);
            if (pool.receivedMessages.length > DEFAULT_RECV_MESSAGES_CACHE) {
                pool.receivedMessages.shift();
            }
        },
        addActiveNode(state: PoolsState, action: PayloadAction<AddActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            pool.activeNodes.push(action.payload.node);
        },
        removeActiveNode(state: PoolsState, action: PayloadAction<RemoveActiveNodeAction>) {
            let pool = state.pools[action.payload.key];
            for (let i = 0; i < pool.activeNodes.length; i++) {
                if (pool.activeNodes[i].nodeID == action.payload.nodeID) {
                    pool.activeNodes.splice(i, 1);
                }
            }
        }
    }
});

export const poolReducer = poolSlice.reducer;
export const poolAction = poolSlice.actions;

