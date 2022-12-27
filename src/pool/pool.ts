import { SSLwtMessage, SSMessage } from "./sync-server.model";
import { PoolClient } from "./pool-client";
import { FILE_ID_LENGTH, Pool, PoolChunkRange, PoolConnectionState, PoolFileInfo, PoolFileOffer, PoolImageOffer, PoolMessageDestinationInfo } from "./pool.model";
import { store } from "../store/store";
import { poolAction, UpdateConnectionStateAction } from "../store/slices/pool.slice";
import { initializePool } from "./sync-server-client";
import { FileManager } from "./global";

export class PoolManagerClass {
    private connectedPools: Map<string, PoolClient>;

    constructor() {
        this.connectedPools = new Map<string, PoolClient>();
    }

    connectToPool(poolID: string, poolKey: number): boolean {
        if (this.connectedPools.has(poolID)) return false;
        store.dispatch(poolAction.updateConnectionState({
            key: poolKey,
            state: PoolConnectionState.CONNECTING,
        } as UpdateConnectionStateAction));
        FileManager.initPoolFileOffers(poolID).then(() => {
            if (this.connectedPools.has(poolID)) return;
            this.connectedPools.set(poolID, initializePool(poolID, poolKey));
        });
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

    sendFileOfferToPool(poolID: string, file: File, fileID?: string, originNodeID?: string): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendFileOffer(file, fileID, originNodeID);
        return true;
    }

    sendRequestFileToPool(poolID: string, fileInfo: PoolFileInfo, isMedia: boolean = false, chunksMissing?: PoolChunkRange[]): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendRequestFile(fileInfo, isMedia, chunksMissing);
        return true;
    }
    
    sendImageOfferToPool(poolID: string, file: File): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendImageOffer(file);
        return true;
    }

    sendRemoveFileRequest(poolID: string, fileOffer: PoolFileOffer): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendRemoveFileRequest(fileOffer);
        return true;
    }

    completeFileDownload(poolID: string, fileID: string): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.completeFileDownload(fileID);
        return true;
    }

    sendRetractFileOffer(poolID: string, fileID: string): boolean {
        let poolClient = this.connectedPools.get(poolID);
        if (!poolClient) return false;
        poolClient.sendRetractFileOffer(fileID);
        return true;
    }
}