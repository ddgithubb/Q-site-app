const registerWebworker = require('webworker-promise/lib/register');
const DB_VERSION = 1;
var objectStoreDB = undefined;

var initDB = () => {
    let resolve;
    let promise = new Promise((res, rej) => {
        resolve = res;
    })
    if (objectStoreDB) {
        resolve(true);
        return promise;
    };
    let req = indexedDB.open('pool-db', DB_VERSION);

    req.onsuccess = (e) => {
        objectStoreDB = req.result;

        let trans = objectStoreDB.transaction('pool-chunks-cache', 'readwrite');
        if (!trans) return;
        trans.objectStore('pool-chunks-cache').clear();
        console.log("DB INIT SUCCESS")
        resolve(true);
    }

    req.onupgradeneeded = (e) => {
        objectStoreDB = req.result;
        req.result.createObjectStore('pool-chunks-cache');
        req.result.createObjectStore('pool-file-offers');
        resolve(true);
    }

    req.onerror = (e) => {
        objectStoreDB = undefined;
        resolve(false);
    }

    return promise;
}

registerWebworker(async (message, emit) => {
    return 'pong';
}).operation('initDB', initDB
).operation('getPoolFileOffers', async (poolID, emit) => {
    let resolve;
    let promise = new Promise((res, rej) => {
        resolve = res;
    })
    let storeName = 'pool-file-offers';

    if (!objectStoreDB) {
        await initDB();
    }

    let trans = objectStoreDB.transaction(storeName, 'readwrite');
    if (!trans) {
        resolve([]);
        return promise;
    }

    let req = trans.objectStore(storeName).get(poolID);
    let fileOffers = [];

    req.onsuccess = async (e) => {
        fileOffers = req.result;
        if (!fileOffers) {
            resolve([]);
            return;
        }

        resolve(fileOffers);
    }

    req.onerror = (e) => {
        resolve([]);
    }

    return promise;
}).operation('updatePoolFileOffer', async ({ poolID, fileOffers }, emit) => {
    let storeName = 'pool-file-offers';
    objectStoreDB.transaction(storeName, 'readwrite')?.objectStore(storeName).put(fileOffers, poolID);
}).operation('addPoolFileOffer', async ({ poolID, fileOffer }, emit) => {
    let storeName = 'pool-file-offers';
    let trans = objectStoreDB.transaction(storeName, 'readwrite');
    if (!trans) return;
    let storeObjectStore = trans.objectStore(storeName);
    let req = storeObjectStore.get(poolID);
    req.onsuccess = (e) => {
        let fileOffers = req.result;
        if (!fileOffers || fileOffers.length == 0) {
            fileOffers = [];
        }
        fileOffers.push(fileOffer);
        storeObjectStore.put(fileOffers, poolID);
    }
}).operation('removePoolFileOffer', async ({ poolID, fileID }, emit) => {
    let storeName = 'pool-file-offers';
    let trans = objectStoreDB.transaction(storeName, 'readwrite');
    if (!trans) return;
    let storeObjectStore = trans.objectStore(storeName);
    let req = storeObjectStore.get(poolID);
    req.onsuccess = (e) => {
        let fileOffers = req.result;
        if (!fileOffers) return;
        for (let i = 0; i < fileOffers.length; i++) {
            if (fileOffers[i].fileID == fileID) {
                fileOffers.splice(i, 1);
                break;
            }
        }
        storeObjectStore.put(fileOffers, poolID);
    }
}).operation('putCacheChunk', async ({ chunks, key, deleteKey }, emit) => {
    let trans = objectStoreDB.transaction('pool-chunks-cache', 'readwrite');
    if (!trans) return;

    let poolChunksCacheStore = trans.objectStore('pool-chunks-cache');

    poolChunksCacheStore.put(chunks, key);

    if (deleteKey != undefined && deleteKey != "") {
        poolChunksCacheStore.delete(deleteKey);
    }
}).operation('getCacheChunk', (key, emit) => {
    let resolve;
    let promise = new Promise((res, rej) => {
        resolve = res;
    })
    if (!objectStoreDB) {
        resolve();
        return promise;
    }
    let trans = objectStoreDB.transaction('pool-chunks-cache', 'readonly');
    let req = trans.objectStore('pool-chunks-cache').get(key);
    req.onsuccess = (e) =>{
        // console.log("SUCCESS CACHE CHUNK", key, req.result);
        resolve(req.result);
    }
    req.onerror = (e) => {
        // console.log("ERROR CACHE CHUNK", key);
        resolve();
    }
    return promise;
});