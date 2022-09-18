const registerWebworker = require('webworker-promise/lib/register');
const DB_VERSION = 1;
var objectStoreDB;

registerWebworker(async (message, emit) => {
    return 'pong';
}).operation('initDB', async (message, emit) => {
    let req = indexedDB.open('pool-db', DB_VERSION);

    req.onsuccess = (e) => {
        objectStoreDB = req.result;

        let trans = objectStoreDB.transaction('pool-chunks-cache', 'readwrite');
        let rc = trans.objectStore('pool-chunks-cache').clear();
        console.log("DB INIT SUCCESS")
        // let rc = trans.objectStore('pool-chunks-cache').getAllKeys();
        // rc.onsuccess = (e) => {
        //     this.cacheChunkQueue = rc.result as string[];
        //     let split: string[];
        //     let cacheChunkData: CacheChunkData;
        //     let existingMapData: CacheChunkMapData | undefined;
        //     for (let i = 0; i < this.cacheChunkQueue.length; i++) {
        //         split = this.cacheChunkQueue[i].split(':')
        //         cacheChunkData = {
        //             key: this.cacheChunkQueue[i],
        //             cacheChunkNumber: parseInt(split[1]),
        //         }
        //         existingMapData = this.cacheChunkMap.get(split[2]);
        //         if (!existingMapData) {
        //             existingMapData = [cacheChunkData];
        //             this.cacheChunkMap.set(split[2], existingMapData)
        //         } else {
        //             let pos = searchPosInCacheChunkMapData(existingMapData, cacheChunkData.cacheChunkNumber);
        //             if (pos >= 0) {
        //                 continue;
        //             } else {
        //                 existingMapData.splice((-pos - 1), 0, cacheChunkData);
        //             }
        //         }
        //     }
        // }
    }

    req.onupgradeneeded = (e) => {
        objectStoreDB = req.result;
        req.result.createObjectStore('pool-chunks-cache');
    }

    req.onerror = (e) => {
        objectStoreDB = undefined;
    }
}).operation('putCacheChunk', async (message, emit) => {
    let trans = objectStoreDB.transaction('pool-chunks-cache', 'readwrite');
    if (!trans) return;

    let poolChunksCacheStore = trans.objectStore('pool-chunks-cache');

    poolChunksCacheStore.put(message.chunks, message.key);

    if (message.deleteKey != undefined && message.deleteKey != "") {
        poolChunksCacheStore.delete(message.deleteKey);
    }
}).operation('getCacheChunk', (message, emit) => {
    let resolve;
    let reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = res;
    })
    if (!objectStoreDB) {
        reject();
        return promise;
    }
    let trans = objectStoreDB.transaction('pool-chunks-cache', 'readonly');
    let req = trans.objectStore('pool-chunks-cache').get(message);
    req.onsuccess = (e) =>{
        // console.log("SUCCESS CACHE CHUNK", key, req.result);
        resolve(req.result);
    }
    req.onerror = (e) => {
        // console.log("ERROR CACHE CHUNK", key);
        reject();
    }
    return promise;
});