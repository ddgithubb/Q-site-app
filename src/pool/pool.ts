import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TIMEOUT_SECONDS, WSHOST } from "../config/http";
import { SSLwtMessage, SSMessage } from "./sync-server.model";
import { PoolClient } from "./pool-client";
import { FILE_ID_LENGTH, Pool, PoolConnectionState, PoolFileInfo, PoolMessageDestinationInfo } from "./pool.model";
import { store } from "../store/store";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";
import { initializePool } from "./sync-server-client";

declare global {
    interface Window { MainPoolClient: PoolClient; }
}

export class PoolManagerClass {
    connectedPools: Map<string, PoolClient>;

    constructor() {
        this.connectedPools = new Map<string, PoolClient>();
    }

    connectToPool(poolID: string, poolKey: number): boolean {
        if (this.connectedPools.has(poolID)) return false;
        store.dispatch(poolAction.updateConnectionState({
            key: poolKey,
            state: PoolConnectionState.CONNECTING,
        } as UpdateConnectionStateAction));
        this.connectedPools.set(poolID, initializePool(poolID, poolKey));
        return true;
    }

    reconnectToPool(poolID: string, poolKey: number): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        store.dispatch(poolAction.updateConnectionState({
            key: poolKey,
            state: PoolConnectionState.RECONNECTING,
        } as UpdateConnectionStateAction));
        poolClient.disconnectFromPool();
        this.connectedPools.set(poolID, initializePool(poolID, poolKey));
        return true;
    }

    disconnectToPool(poolID: string, poolKey: number): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        store.dispatch(poolAction.updateConnectionState({
            key: poolKey,
            state: PoolConnectionState.CLOSED,
        } as UpdateConnectionStateAction));
        poolClient.disconnectFromPool();
        this.connectedPools.delete(poolID);
        return true;
    }

    sendTextMessageToPool(poolID: string, text: string): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendTextMessage(text);
        return true;
    }

    sendFileOfferToPool(poolID: string, file: File): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendFileOffer(file);
        return true;
    }

    async sendRequestFileToPool(poolID: string, poolFileInfo: PoolFileInfo, chunksMissing?: number[][]): Promise<boolean> {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        await poolClient.sendRequestFile(poolFileInfo, chunksMissing);
        return true;
    }
}