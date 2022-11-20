import { nanoid } from "nanoid";
import { fileSizeToString, kibibytesToBytes, mebibytesToBytes } from "../helpers/file-size";
import { poolAction, RemoveDownloadAction, SetMediaURLAction, UpdateDownloadProgressAction } from "../store/slices/pool.slice";
import { getStoreState, store } from "../store/store";
import { PoolManager } from "./global";
import { getCacheChunkNumberFromChunkNumber, searchPosInCacheChunkMapData } from "./pool-chunks";
import { PoolChunkRange, PoolFileInfo, PoolFileRequest, PoolNode } from "./pool.model";
// @ts-expect-error
import PoolWorker from 'worker-loader!./pool.worker.js'
import { CACHE_CHUNK_SIZE, CHUNK_SIZE, CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR } from "../config/caching";
import { verifyFileHandlePermission } from "../helpers/file-exists";
import { APP_TYPE } from "../config/env";

const WebworkerPromise = require('webworker-promise');
const worker = new WebworkerPromise(new PoolWorker());

export interface FileOffer extends PoolFileInfo {
    file: File;
}

interface FileDownload {
    poolID: string;
    poolKey: number;
    poolFileInfo: PoolFileInfo;
    lastModified: number;
    lastProgress: number;
    totalChunks: number;
    chunksDownloaded: number;
    chunksDownloadedMap: boolean[];
    isMedia: boolean;
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

interface MediaCacheInfo {
    fileID: string;
    size: number;
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
    private fileOffers: Map<string, Map<string, FileOffer>>; // key: PoolID, key: fileID
    fileDownloads: Map<string, FileDownload>; // key: fileID
    fileDownloadTimer: NodeJS.Timer | undefined;
    fileCacheChunks: Map<string, CacheChunk>; // key: fileID
    cacheChunkMapDataFlushTimer: NodeJS.Timer | undefined;
    cacheChunkQueue: string[]; // value: cache key
    cacheChunkMap: Map<string, CacheChunkMapData>; // key: fileID
    maxCacheChunkCount: number;
    mediaCacheObjectURL: Map<string, string>; // key: fileID
    mediaCacheQueue: MediaCacheInfo[];
    curMediaCacheSize: number;
    maxMediaCacheSize: number;
    private webworker: any;

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
        this.cacheChunkQueue = [];
        this.cacheChunkMap = new Map<string, CacheChunkMapData>;
        this.webworker = worker;
        this.maxCacheChunkCount = store.getState().setting.storageSettings.maxCacheChunkSize / CACHE_CHUNK_SIZE;
        this.mediaCacheObjectURL = new Map<string, string>;
        this.mediaCacheQueue = [];
        this.curMediaCacheSize = 0;
        this.maxMediaCacheSize = store.getState().setting.storageSettings.maxMediaCacheSize;
    }

    init(): Promise<boolean> {
        return this.webworker.exec('initDB');
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
        if (this.fileDownloadTimer) return;
        this.fileDownloadTimer = setInterval(() => {
            if (this.fileDownloads.size == 0) {
                clearInterval(this.fileDownloadTimer);
                this.fileDownloadTimer = undefined;
                return;
            }
            this.fileDownloads.forEach((fileDownload, fileID) => {
                // if (fileDownload.chunksDownloaded == 0) return;
                if (Date.now() >= fileDownload.lastModified + 5000) {
                    console.log("5 SECONDS NO CHUNKS INTERVAL")
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
                        console.log("CHUNKS MISSING:", chunksMissing);
                        PoolManager.sendRequestFileToPool(fileDownload.poolID, fileDownload.poolFileInfo, fileDownload.isMedia, chunksMissing);
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

    initPoolFileOffers(poolID: string): Promise<void> {
        if (APP_TYPE == 'desktop' || this.fileOffers.has(poolID)) return Promise.resolve();
        return this.webworker.exec('getPoolFileOffers', poolID).then(async (fileOffers: FileOffer[]) => {
            let poolFileOffers = this.fileOffers.get(poolID);
            if (!poolFileOffers) {
                poolFileOffers = new Map<string, FileOffer>;
                this.fileOffers.set(poolID, poolFileOffers);
            }
            //let updatedFileOffers = false;
            for (let i = fileOffers.length - 1; i >= 0; i--) {
                // if (fileOffers[i].fileHandle == undefined) continue; // SHOULD NEVER HAPPEN
                // let granted = await verifyFileHandlePermission(fileOffers[i].fileHandle!);
                // if (!granted) {
                //     fileOffers.splice(i, 1);
                //     updatedFileOffers = true;
                //     continue;
                // }
                poolFileOffers.set(fileOffers[i].fileID, fileOffers[i]);
            }
            // if (updatedFileOffers) {
            //     this.webworker.exec('updatePoolFileOffer', {
            //         poolID: poolID,
            //         fileOffers: fileOffers,
            //     })
            // }
            return;
        })
    }

    addFileOffer(poolID: string, fileInfo: PoolFileInfo, file: File): boolean {
        if (file.size == 0) return false;
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) {
            poolFileOffers = new Map<string, FileOffer>;
            this.fileOffers.set(poolID, poolFileOffers);
        }
        if (!poolFileOffers.has(fileInfo.fileID)) {
            let fileOffer: FileOffer = {
                ...fileInfo,
                file: file,
            };
            poolFileOffers.set(fileInfo.fileID, fileOffer);
            if (APP_TYPE == 'desktop') {
                this.webworker.exec('addPoolFileOffer', {
                    poolID: poolID,
                    fileOffer: fileOffer,
                });
            }
            return true;
        }
        return false;
    }

    hasFileOffer(poolID: string, fileID: string): boolean {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return false;
        return poolFileOffers.has(fileID);
    }

    getFileOffer(poolID: string, fileID: string): FileOffer | undefined {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return undefined;
        return poolFileOffers.get(fileID);
    }

    removeFileoffer(poolID: string, fileID: string) {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return;
        let fileOffer = poolFileOffers.get(fileID);
        if (!fileOffer) return;
        poolFileOffers.delete(fileID);
        if (APP_TYPE == 'desktop') {
            this.webworker.exec('removePoolFileOffer', {
                poolID: poolID,
                fileID: fileID,
            });
        }
    }

    getFileOffers(poolID: string): FileOffer[] | undefined  {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return undefined;
        return Array.from(poolFileOffers.values());
    }

    getFileDownloadProgress(fileID: string): number {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return 0;
        return fileDownload.chunksDownloaded / fileDownload.totalChunks;
    }

    hasFileDownload(fileID: string) {
        return this.fileDownloads.has(fileID);
    }

    async addFileDownload(poolID: string, poolKey: number, poolFileInfo: PoolFileInfo, isMedia: boolean): Promise<boolean> {
        if (!this.checkFileSizeLimit(poolFileInfo.totalSize)) return false;
        if (this.fileDownloads.has(poolFileInfo.fileID)) return true;
        let directoryHandle = undefined;
        let fileHandle = undefined;
        let fileStream = undefined;
        if (!isMedia && this.fileSystemAccess) {
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
            poolID: poolID,
            poolKey: poolKey,
            poolFileInfo: poolFileInfo,
            lastModified: Date.now(),
            totalChunks: totalChunks,
            chunksDownloaded: 0,
            chunksDownloadedMap: chunksDownloadedMap,
            directoryHandle: directoryHandle,
            isMedia: isMedia,
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
        if (fileDownload.chunksDownloadedMap[chunkNumber] == true) {
            console.log("ALREADY RECEIVED", chunkNumber);
            return;
        }

        //console.log("ADDING FILE CHUNK", chunkNumber);

        let offset = chunkNumber * CHUNK_SIZE
        if (!fileDownload.isMedia && this.fileSystemAccess) {
            fileDownload.fileStream?.write({ type: "write", position: offset, data: binaryData }).catch((e) => {
                console.log(e);
                this.completeFileDownload(fileID)
            });
        } else {
            fileDownload.memoryChunks?.set(new Uint8Array(binaryData), offset);
        }

        fileDownload.lastModified = Date.now();
        fileDownload.chunksDownloadedMap[chunkNumber] = true;
        fileDownload.chunksDownloaded++;

        let progress = Math.trunc((fileDownload.chunksDownloaded / fileDownload.totalChunks) * 100);
        if (progress != fileDownload.lastProgress) {
            fileDownload.lastProgress = progress;
            store.dispatch(poolAction.updateDownloadProgress({
                key: fileDownload.poolKey,
                fileID: fileDownload.poolFileInfo.fileID,
                progress: progress,
            } as UpdateDownloadProgressAction));
        }
        
        if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
            this.completeFileDownload(fileID);
        }
    }
    
    completeFileDownload(fileID: string) {
        // client activated OR we see disconnected node
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return;
        console.log(fileDownload, Date.now())
        if (!fileDownload.isMedia && this.fileSystemAccess) {
            if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
                fileDownload.fileStream?.close().then(() => {            
                    fileDownload?.fileHandle?.getFile().then((file) => {
                        if (!fileDownload) return;
                        PoolManager.sendFileOfferToPool(fileDownload.poolID, file, fileDownload.poolFileInfo.fileID, fileDownload.poolFileInfo.originNodeID);
                    });
                });
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
                let blob = new Blob([fileDownload.memoryChunks]);
                if (fileDownload.isMedia) {
                    this.addMediaCache(fileID, blob);
                } else {
                    this.downloadFile(fileDownload.poolFileInfo.fileName, blob);
                }
            }
            fileDownload.memoryChunks = undefined;
        }

        if (fileDownload.chunksDownloaded != fileDownload.totalChunks) {
            alert("Error downloading " + fileDownload.poolFileInfo.fileName);
        }

        store.dispatch(poolAction.removeDownload({
            key: fileDownload!.poolKey,
            fileID: fileDownload!.poolFileInfo.fileID,
        } as RemoveDownloadAction))
        PoolManager.completeFileDownload(fileDownload.poolID, fileDownload.poolFileInfo.fileID);
        
        this.fileDownloads.delete(fileID);
    }

    cacheFileChunk(fileID: string, chunkNumber: number, totalSize: number, chunk: ArrayBuffer) {
        if (!this.cacheChunkMapDataFlushTimer) this.startCacheChunksFlushTimer();

        let cacheChunkNumber = getCacheChunkNumberFromChunkNumber(chunkNumber);
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
            }
        }
        this.cacheChunkQueue.push(key);

        let deleteKey: string | undefined = undefined;
        if (this.cacheChunkQueue.length > this.maxCacheChunkCount) {
            deleteKey = this.cacheChunkQueue.shift();
            if (deleteKey != undefined && deleteKey != "") {
                this.deleteKeyFromCacheChunkMap(deleteKey);
            }
            console.log("DELETING CACHE CHUNK KEY:", deleteKey);
        }
        
        this.webworker.exec('putCacheChunk', {
            chunks: cacheChunk.chunks,
            key: key,
            deleteKey: deleteKey,
        }, cacheChunk.chunks);
    }

    deleteKeyFromCacheChunkMap(key: string) {
        let split = key.split(':');
        let data = this.cacheChunkMap.get(split[2]);
        if (data) {
            let pos = searchPosInCacheChunkMapData(data, parseInt(split[1]));
            if (pos >= 0) {
                data.splice(pos, 1);
            }
        }
    }

    getCacheChunk(key: string): Promise<ArrayBuffer[]> {
        return this.webworker.exec('getCacheChunk', key).then((ab: any) => {
            if (!ab) {
                this.deleteKeyFromCacheChunkMap(key);
            }
            return ab;
        });
    }

    addMediaCache(fileID: string, blob: Blob) {
        this.mediaCacheObjectURL.set(fileID, URL.createObjectURL(blob));
        this.mediaCacheQueue.push({
            fileID: fileID,
            size: blob.size,
        } as MediaCacheInfo);
        this.curMediaCacheSize += blob.size;

        if (this.curMediaCacheSize > this.maxMediaCacheSize) {
            let mediaCacheInfo = this.mediaCacheQueue.shift();
            if (!mediaCacheInfo) return;
            let url = this.mediaCacheObjectURL.get(mediaCacheInfo.fileID);
            if (!url) return;
            URL.revokeObjectURL(url);
            this.mediaCacheObjectURL.delete(mediaCacheInfo.fileID);
            this.curMediaCacheSize -= mediaCacheInfo.size;
        }
    }

    getMediaCache(fileID: string): string | undefined {
        return this.mediaCacheObjectURL.get(fileID);
    }

    hasMediaCache(fileID: string): boolean {
        return this.mediaCacheObjectURL.has(fileID);
    }
}