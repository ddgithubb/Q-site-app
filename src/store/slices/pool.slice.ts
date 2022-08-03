import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_MESSAGES_CACHE, DEFAULT_RECV_MESSAGES_CACHE } from "../../config/caching";
import { NodeState, Pool, PoolInfo, PoolUpdateLatest, PoolMessage, PoolMessageType, PoolNode, PoolMessageInfo, PoolConnectionState, PoolUser } from "../../pool/pool.model";

export interface PoolsState {
    pools: Pool[];
}

const initialState: PoolsState = {
    pools: [],
}

export interface UpdateConnectionStateAction {
    key: number;
    state: PoolConnectionState;
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
                    connectionState: PoolConnectionState.CLOSED,
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
        updateConnectionState(state: PoolsState, action: PayloadAction<UpdateConnectionStateAction>) {
            state.pools[action.payload.key].connectionState = action.payload.state;
        },
        updateLatest(state: PoolsState, action: PayloadAction<UpdateLatestAction>) {
            let pool = state.pools[action.payload.key];
            if (!action.payload.latest.messagesOnly) {
                pool.activeNodes = action.payload.latest.activeNodes;
                for (let i = pool.activeNodes.length - 1; i >= 0; i--) {
                    if (pool.activeNodes[i].nodeID == pool.myNode.nodeID) {
                        pool.activeNodes.splice(i, 1);
                        return;
                    }
                }
            }
            if (action.payload.latest.lastMessageID == "") {
                pool.messages = action.payload.latest.messages;
            } else {
                let i = pool.messages.length - 1;
                for (; i >= 0; i--) {
                    if (pool.messages[i].msgID == action.payload.latest.lastMessageID) {
                        break;
                    }
                }
                if (i == -1) {
                    pool.messages = action.payload.latest.messages;
                } else if ((pool.messages.length - 1 - i) < action.payload.latest.messages.length) {
                    pool.messages = pool.messages.slice(0, i + 1);
                    pool.messages.push(...action.payload.latest.messages);
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

