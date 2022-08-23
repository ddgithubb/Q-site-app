import { nanoid } from "nanoid";
import { fileSizeToString, kibibytesToBytes, mebibytesToBytes } from "../helpers/file-size";
import { store } from "../store/store";
import { PoolManager } from "./global";
import { getCacheChunkNumber, searchPosInCacheChunkMapData } from "./pool-chunks";
import { PoolChunkRange, PoolFileInfo, PoolFileRequest, PoolNode } from "./pool.model";

export const CHUNK_SIZE = kibibytesToBytes(16);
//export const CACHE_CHUNK_SIZE = kibibytesToBytes(128);
export const CACHE_CHUNK_SIZE = mebibytesToBytes(1);
//const chunkSize = mebibytesToBytes(1);
export const CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR = CACHE_CHUNK_SIZE / CHUNK_SIZE;
export const OVERFLOW_CACHE_REDUCTION_AMOUNT = 100;
export const DB_VERSION = 1;

interface FileOffer {
    file: File;
    retracted: boolean;
}

interface FileDownload {
    poolFileInfo: PoolFileInfo;
    poolID: string;
    lastModified: number;
    totalChunks: number;
    chunksDownloaded: number;
    chunksDownloadedMap: boolean[];
    directoryHandle?: FileSystemDirectoryHandle;
    fileHandle?: FileSystemFileHandle;
    fileStream?: FileSystemWritableFileStream;
    memoryChunks?: Uint8Array;
}

interface CacheChunk {
    lastModified: number;
    cacheChunkNumber: number;
    chunkRange: PoolChunkRange;
    chunks: ArrayBuffer[];
}

export type CacheChunkMapData = CacheChunkData[];

export interface CacheChunkData {
    key: string;
    cacheChunkNumber: number;
}

export class FileManagerClass {
    fileSystemAccess: boolean;
    downloadLink?: HTMLAnchorElement;
    currentFileDownloadSize: number; // size of fileDownloads and fileStore
    fileOffers: Map<string, Map<string, FileOffer>>; // key: PoolID, key: fileID
    fileDownloads: Map<string, FileDownload>; // key: fileID
    fileDownloadTimer: NodeJS.Timer | undefined;
    fileCacheChunks: Map<string, CacheChunk>; // key: fileID
    cacheChunkMapDataFlushTimer: NodeJS.Timer | undefined;
    objectStoreDB: IDBDatabase | undefined;
    cacheChunkMap: Map<string, CacheChunkMapData>; // key: fileID
    currentCacheChunkSize: number | undefined;
    maxCacheChunkSize: number;

    constructor() {
        // for electron file manager, get from appdata + verify existence/populate on start/
        this.fileSystemAccess = window.showSaveFilePicker as any ? true : false;
        if (!this.fileSystemAccess) {
            this.downloadLink = document.createElement('a');
            this.downloadLink.style.display = 'none';
            document.body.appendChild(this.downloadLink);
        }
        this.fileOffers = new Map<string, Map<string, FileOffer>>;
        this.fileDownloads = new Map<string, FileDownload>;
        this.fileDownloadTimer = undefined;
        this.currentFileDownloadSize = 0;
        this.fileCacheChunks = new Map<string, CacheChunk>;
        this.cacheChunkMapDataFlushTimer = undefined;
        this.objectStoreDB = undefined;
        this.cacheChunkMap = new Map<string, CacheChunkMapData>;
        this.currentCacheChunkSize = undefined;
        this.maxCacheChunkSize = store.getState().setting.storageSettings.maxCacheChunkSize / CACHE_CHUNK_SIZE;

        this.getObjectStore();
    }

    private getObjectStore() {
        let req = indexedDB.open('pool-db', DB_VERSION);

        req.onsuccess = (e) => {
            this.objectStoreDB = req.result;

            let trans = this.objectStoreDB.transaction(['pool-chunks-cache', 'pool-chunks-map'], 'readonly');

            let rm = trans.objectStore('pool-chunks-map').openCursor();
            rm.onsuccess = (e) => {
                let cursor = rm.result;
                if (!cursor) return;
                this.cacheChunkMap.set(cursor.key as string, cursor.value);
                cursor.continue();
            }

            let rc = trans.objectStore('pool-chunks-cache').count();
            rc.onsuccess = (e) => {
                this.currentCacheChunkSize = rc.result;
            }

            // window.removeEventListener('unload', () => {
            //     if (!this.objectStoreDB) return;
            //     let store =this.objectStoreDB.transaction('pool-chunks-map', 'readwrite').objectStore('pool-chunks-map');
            //     store.clear()
            //     this.cacheChunkMap.forEach((data, fileID) => {
            //         store.put(data, fileID);
            //     })
            // });
        }

        req.onupgradeneeded = (e) => {
            this.objectStoreDB = req.result;
            req.result.createObjectStore('pool-chunks-cache');
            req.result.createObjectStore('pool-chunks-map');
        }

        req.onerror = (e) => {
            this.objectStoreDB = undefined;
        }
    } 

    private startCacheChunksFlushTimer() {
        if (this.cacheChunkMapDataFlushTimer) return;
        this.cacheChunkMapDataFlushTimer = setInterval(() => {
            if (this.fileCacheChunks.size == 0) {
                clearInterval(this.cacheChunkMapDataFlushTimer);
                this.cacheChunkMapDataFlushTimer = undefined;
                return;
            }
            this.fileCacheChunks.forEach((cacheChunk, key) => {
                if (Date.now() >= cacheChunk.lastModified + 5000) {
                    cacheChunk.chunks = [];
                    this.fileCacheChunks.delete(key);
                }
            })
        }, 5000);
    }

    private startFileDownloadTimer() {
        // PROBLEM, GETTING SECOND WILL TRIGGER MULTIPLE TIMES
        if (this.fileDownloadTimer) return;
        this.fileDownloadTimer = setInterval(() => {
            if (this.fileDownloads.size == 0) {
                clearInterval(this.fileDownloadTimer);
                this.fileDownloadTimer = undefined;
                return;
            }
            this.fileDownloads.forEach((fileDownload, fileID) => {
                if (Date.now() >= fileDownload.lastModified + 5000) {
                    if (Date.now() >= fileDownload.lastModified + 10000) {
                        console.log("Didn't get chunks in 10 seconds")
                        this.completeFileDownload(fileID);
                    } else {
                        console.log("Didn't get chunks in 5 seconds")
                        let chunksMissing: number[][] = []; 
                        let curRange: number[] | undefined = undefined;
                        for (let i = 0; i < fileDownload.chunksDownloadedMap.length; i++) {
                            if (!fileDownload.chunksDownloadedMap[i]) {
                                if (!curRange) {
                                    curRange = [i, i];
                                    chunksMissing.push(curRange);
                                } else {
                                    if (i - 1 == curRange[1]) {
                                        curRange[1] = i;
                                    } else {
                                        curRange = [i, i];
                                        chunksMissing.push(curRange);
                                    }
                                }
                            }
                        }
                        if (chunksMissing.length != 0) {
                            PoolManager.sendRequestFileToPool(fileDownload.poolID, fileDownload.poolFileInfo, chunksMissing);
                        }
                    }
                }
            });
        }, 5000);
    }

    downloadFile(fileName: string, blob: Blob) {
        if (!this.downloadLink) return;
        this.downloadLink.download = fileName;
        this.downloadLink.href = URL.createObjectURL(blob);
        this.downloadLink.click();
        URL.revokeObjectURL(this.downloadLink.href);
    }

    checkFileSizeLimit(fileSize: number): boolean {
        if (!this.fileSystemAccess) {
            let fileSizeLimit = store.getState().setting.storageSettings.maxFileCacheSize;
            if (fileSize > fileSizeLimit) {
                alert("Cannot download files with size greater than " + fileSizeToString(fileSizeLimit, 0));
                return false;
            } else if (fileSize + this.currentFileDownloadSize > fileSizeLimit) {
                alert("Please wait for current files to complete downloading (to free up memory)!");
                return false;
            }
        }
        return true;
    }

    addFileOffer(poolID: string, fileID: string, file: File): boolean {
        if (file.size == 0) return false;
        let poolFileOffer = this.fileOffers.get(poolID);
        if (!poolFileOffer) {
            poolFileOffer = new Map<string, FileOffer>;
        }
        poolFileOffer.set(fileID, {
            file: file,
            retracted: false,
        } as FileOffer);
        this.fileOffers.set(poolID, poolFileOffer);
        return true;
    }

    async addFileDownload(poolID: string, poolFileInfo: PoolFileInfo): Promise<boolean> {
        if (!this.checkFileSizeLimit(poolFileInfo.totalSize)) return false;
        let directoryHandle = undefined;
        let fileHandle = undefined;
        let fileStream = undefined;
        if (this.fileSystemAccess) {
            try {
                directoryHandle = await window.showDirectoryPicker({
                    id: "default_export_folder",
                    mode: "readwrite",
                    startIn: "documents",
                } as DirectoryPickerOptions);
                fileHandle = await directoryHandle.getFileHandle(Date.now().toString() + "-" + poolFileInfo.fileName, {
                    create: true,
                } as FileSystemGetFileOptions);
                fileStream = await fileHandle.createWritable();
            } catch (e) {
                console.log(e);
                alert("Error with chosen export folder");
                return false;
            }
        } else {
            this.currentFileDownloadSize += poolFileInfo.totalSize;
        }
        let chunksDownloadedMap = [];
        let totalChunks = Math.ceil(poolFileInfo.totalSize / CHUNK_SIZE);
        chunksDownloadedMap[totalChunks - 1] = false;
        this.fileDownloads.set(poolFileInfo.fileID, {
            poolFileInfo: poolFileInfo,
            poolID: poolID,
            lastModified: Date.now(),
            totalChunks: totalChunks,
            chunksDownloaded: 0,
            chunksDownloadedMap: chunksDownloadedMap,
            directoryHandle: directoryHandle,
            fileHandle: fileHandle,
            fileStream: fileStream,
            memoryChunks: fileStream ? undefined : new Uint8Array(poolFileInfo.totalSize),
        } as FileDownload);
        this.startFileDownloadTimer();
        console.log("Downloading...", Date.now())
        return true;
    }

    addFileChunk(fileID: string, chunkNumber: number, binaryData: ArrayBuffer) {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return;
        if (fileDownload.chunksDownloadedMap[chunkNumber] == true) return

        let offset = chunkNumber * CHUNK_SIZE
        if (this.fileSystemAccess) {
            fileDownload.fileStream?.write({ type: "write", position: offset, data: binaryData }).catch((e) => this.completeFileDownload(fileID));
        } else {
            fileDownload.memoryChunks?.set(new Uint8Array(binaryData), offset);
        }

        fileDownload.lastModified = Date.now();
        fileDownload.chunksDownloadedMap[chunkNumber] = true;
        fileDownload.chunksDownloaded++;
        
        if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
            this.completeFileDownload(fileID);
        }
    }
    
    completeFileDownload(fileID: string) {
        // client activated OR we see disconnected node
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return;
        console.log(fileDownload, Date.now())
        if (this.fileSystemAccess) {
            if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
                fileDownload.fileStream?.close();
            } else {
                if (fileDownload.fileHandle) {
                    fileDownload.directoryHandle?.removeEntry(fileDownload.fileHandle?.name);
                }
                fileDownload.fileStream?.abort();
            }
        } else {
            if (!fileDownload.memoryChunks) return;
            this.currentFileDownloadSize -= fileDownload.poolFileInfo.totalSize;
            if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
                this.downloadFile(fileDownload.poolFileInfo.fileName, new Blob([fileDownload.memoryChunks]));
            }
            fileDownload.memoryChunks = undefined;
        }
        this.fileDownloads.delete(fileID);
    }

    cacheFileChunk(fileID: string, chunkNumber: number, totalSize: number, chunk: ArrayBuffer) {
        if (!this.objectStoreDB) return;
        if (!this.cacheChunkMapDataFlushTimer) this.startCacheChunksFlushTimer();

        let cacheChunkNumber = getCacheChunkNumber(chunkNumber);
        let cacheChunk = this.fileCacheChunks.get(fileID);
        if (!cacheChunk) {
            cacheChunk = {
                lastModified: Date.now(),
                cacheChunkNumber: cacheChunkNumber,
                chunkRange: [chunkNumber, chunkNumber],
                chunks: [chunk],
            }
            this.fileCacheChunks.set(fileID, cacheChunk);
        } else {
            cacheChunk.lastModified = Date.now();
            if (cacheChunk.cacheChunkNumber == cacheChunkNumber) {
                if (chunkNumber == cacheChunk.chunkRange[1] + 1) {
                    cacheChunk.chunks.push(chunk);
                    cacheChunk.chunkRange[1] = cacheChunk.chunkRange[1] + 1;
                } else if (chunkNumber >= cacheChunk.chunkRange[0] && chunkNumber <= cacheChunk.chunkRange[1]) {
                    return;
                } else if (chunkNumber % CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR == 0) {
                    cacheChunk.chunkRange = [ chunkNumber, chunkNumber ]
                    cacheChunk.chunks = [ chunk ];
                }
            } else {
                cacheChunk.cacheChunkNumber = cacheChunkNumber;
                cacheChunk.chunkRange = [ chunkNumber, chunkNumber ]
                cacheChunk.chunks = [ chunk ];
            }
        }

        if (cacheChunk.chunks.length == CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR) {
            this.flushCacheChunk(fileID, cacheChunk);
        } else if (cacheChunk.chunkRange[1] == chunkNumber && chunkNumber == Math.ceil(totalSize / CHUNK_SIZE) - 1) {
            console.log("LAST CHUNK")
            this.flushCacheChunk(fileID, cacheChunk);
        }

    }

    flushCacheChunk(fileID: string, cacheChunk: CacheChunk) {
        this.fileCacheChunks.delete(fileID);
        if (!this.objectStoreDB) return;

        // console.log("Flushing", cacheChunk.cacheChunkNumber);

        let cacheChunkMapData = this.cacheChunkMap.get(fileID);
        let key = Date.now() + ":" + cacheChunk.cacheChunkNumber.toString() + ":" + fileID;
        let cacheChunkData: CacheChunkData = {
            key: key,
            cacheChunkNumber: cacheChunk.cacheChunkNumber,
        };

        if (!cacheChunkMapData) {
            cacheChunkMapData = [cacheChunkData];
            this.cacheChunkMap.set(fileID, cacheChunkMapData)
        } else {
            let pos = searchPosInCacheChunkMapData(cacheChunkMapData, cacheChunk.cacheChunkNumber);
            if (pos >= 0) {
                return;
            } else {
                cacheChunkMapData.splice((-pos - 1), 0, cacheChunkData);
                if (this.currentCacheChunkSize) this.currentCacheChunkSize++;
            }
        }

        let trans = this.objectStoreDB.transaction(['pool-chunks-cache', 'pool-chunks-map'], 'readwrite');
        if (!trans) return;

        let poolChunksCacheStore = trans.objectStore('pool-chunks-cache');
        let poolChunksMapStore = trans.objectStore('pool-chunks-map');

        poolChunksMapStore.put(cacheChunkMapData, fileID)
        poolChunksCacheStore.put(cacheChunk.chunks, key);

        if (this.currentCacheChunkSize && this.currentCacheChunkSize > this.maxCacheChunkSize) {
            let overflowSize = (this.currentCacheChunkSize - this.maxCacheChunkSize) + OVERFLOW_CACHE_REDUCTION_AMOUNT;
            let r = poolChunksCacheStore.openCursor();
            r.onsuccess = (e) => {
                if (!r.result) return;
                let key: string = r.result.key as string;
                let info = key.split(':');
                let data = this.cacheChunkMap.get(info[2]);
                if (data) {
                    let pos = searchPosInCacheChunkMapData(data, parseInt(info[1]));
                    if (pos >= 0) {
                        data.splice(pos, 1);
                    }
                    if (data.length != 0) {
                        poolChunksMapStore.put(data, info[2]);
                    } else {
                        poolChunksMapStore.delete(info[2]);
                    }
                }
                poolChunksCacheStore.delete(key);
                overflowSize--;
                this.currentCacheChunkSize!--;
                if (overflowSize == 0) return;
                r.result.continue();
            }
        }
    }

    getCacheChunk(key: string): Promise<ArrayBuffer[]> {
        let resolve: (value: ArrayBuffer[] | PromiseLike<ArrayBuffer[]>) => void;
        let reject: (reason?: any) => void;
        let promise = new Promise<ArrayBuffer[]>((res, rej) => {
            resolve = res;
            reject = res;
        })
        if (!this.objectStoreDB) {
            reject!();
            return promise;
        }
        let trans = this.objectStoreDB.transaction(['pool-chunks-cache'], 'readonly');
        let req = trans.objectStore('pool-chunks-cache').get(key);
        req.onsuccess = (e) =>{
            resolve(req.result);
        }
        req.onerror = (e) => {
            reject();
        }
        return promise;
    }

    removeFileoffer() {
        // remember to mark retracted?: boolean
    }
}