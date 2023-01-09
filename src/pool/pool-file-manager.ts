import { nanoid } from "nanoid";
import { fileSizeToString, kibibytesToBytes, mebibytesToBytes } from "../utils/file-size";
import { AddDownloadAction, poolAction, RemoveDownloadAction } from "../store/slices/pool.slice";
import { getStoreState, store } from "../store/store";
import { FileManager, PoolManager } from "./global";
import { addToChunkRanges, compactChunkRanges, deleteCacheChunkFromChunkRanges, existsInChunkRanges, getCacheChunkNumberFromChunkNumber, inChunkRange } from "./pool-chunks";
// import { PoolChunkRange, PoolDownloadProgressStatus, PoolFileInfo, PoolFileRequest, PoolNode } from "./pool.model";
// @ts-expect-error
import PoolWorker from 'worker-loader!./pool.worker.js'
import { CACHE_CHUNK_SIZE, CHUNK_SIZE, CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR } from "../config/caching";
import { verifyFileHandlePermission } from "../utils/file-exists";
import { APP_TYPE } from "../config/env";
import { PoolChunkRange, PoolFileInfo } from "./pool.v1";
import { Pool, PoolDownloadProgressStatus } from "./pool.model";

var worker: any = undefined;

if (typeof(Worker) !== "undefined") {
    const WebworkerPromise = require('webworker-promise');
    worker = new WebworkerPromise(new PoolWorker());
}

export interface PoolFile {
    fileInfo: PoolFileInfo;
    file: File;
}

interface FileDownload {
    poolID: string;
    poolKey: number;
    fileInfo: PoolFileInfo;
    lastModified: number;
    status: PoolDownloadProgressStatus;
    totalChunks: number;
    chunksDownloaded: number;
    chunksDownloadedMap: boolean[];
    isMedia: boolean;
    lastRequestedNodeID: string;
    lastProgress: number;
    retryCount: number;
    hinterNodeIDs?: string[];
    directoryHandle?: FileSystemDirectoryHandle;
    fileHandle?: FileSystemFileHandle;
    fileStream?: FileSystemWritableFileStream;
    memoryChunks?: Uint8Array;
}

interface CacheChunk {
    lastModified: number;
    cacheChunkNumber: number;
    chunkRange: PoolChunkRange;
    chunks: Uint8Array[];
}

interface MediaCacheInfo {
    fileID: string;
    size: number;
}

// export type CacheChunkMapData = CacheChunkData[];

// Implement LRU cache on desktop version!
export interface CacheChunkData {
    key: string; // key is only for browser
    // keys for desktop are just fileID and cacheChunkNumber which
    // if have CacheChunkData info, would already know fileID and cacheChunkNumber

    // offset for desktop
    chunkRanges: PoolChunkRange[];
}

export class FileManagerClass {
    private fileSystemAccess: boolean;
    private downloadLink?: HTMLAnchorElement;
    private currentFileDownloadSize: number; // size of fileDownloads and fileStore
    private fileOffers: Map<string, Map<string, PoolFile>>; // key: PoolID, key: fileID
    private fileDownloads: Map<string, FileDownload>; // key: fileID
    private fileDownloadTimer: NodeJS.Timer | undefined;
    private fileCacheChunks: Map<string, CacheChunk>; // key: fileID
    private cacheChunkFlushTimer: NodeJS.Timer | undefined;
    private cacheChunkQueue: string[]; // value: cache key
    private cacheChunkMap: Map<string, Map<number, CacheChunkData>>; // key: fileID, // subkey: cacheChunkNumber
    private maxCacheChunkCount: number;
    private mediaCacheObjectURL: Map<string, string>; // key: fileID
    private mediaCacheQueue: MediaCacheInfo[];
    private curMediaCacheSize: number;
    private maxMediaCacheSize: number;
    private webworkerAccess: boolean;
    private webworker: any;

    constructor() {
        // for electron file manager, get from appdata + verify existence/populate on start/
        this.fileSystemAccess = window.showSaveFilePicker as any ? true : false;
        if (!this.fileSystemAccess) {
            this.downloadLink = document.createElement('a');
            this.downloadLink.style.display = 'none';
            document.body.appendChild(this.downloadLink);
        }
        this.fileOffers = new Map<string, Map<string, PoolFile>>();
        this.fileDownloads = new Map<string, FileDownload>();
        this.fileDownloadTimer = undefined;
        this.currentFileDownloadSize = 0;
        this.fileCacheChunks = new Map<string, CacheChunk>();
        this.cacheChunkFlushTimer = undefined;
        this.cacheChunkQueue = [];
        this.cacheChunkMap = new Map<string, Map<number, CacheChunkData>>();
        this.maxCacheChunkCount = store.getState().setting.storageSettings.maxCacheChunkSize / CACHE_CHUNK_SIZE;
        this.mediaCacheObjectURL = new Map<string, string>();
        this.mediaCacheQueue = [];
        this.curMediaCacheSize = 0;
        this.maxMediaCacheSize = store.getState().setting.storageSettings.maxMediaCacheSize;
        this.webworkerAccess = false;
        if (worker !== undefined) {
            this.webworkerAccess = true;
            this.webworker = worker;
        }
    }

    init(): Promise<boolean> {
        if (!this.webworkerAccess) {
            return Promise.resolve(false);
        }
        return this.webworker.exec('initDB');
    } 

    cleanUp() {
        this.fileDownloads.forEach((fileDownload, fileID) => {
            this.completeFileDownload(fileID);
        });
    }

    private startCacheChunksFlushTimer() {
        if (this.cacheChunkFlushTimer) return;
        this.cacheChunkFlushTimer = setInterval(() => {
            if (this.fileCacheChunks.size == 0) {
                clearInterval(this.cacheChunkFlushTimer);
                this.cacheChunkFlushTimer = undefined;
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
                    let chunksMissing: PoolChunkRange[] = [];
                    let curRange: PoolChunkRange | undefined = undefined;
                    for (let i = 0; i < fileDownload.chunksDownloadedMap.length; i++) {
                        if (!fileDownload.chunksDownloadedMap[i]) {
                            if (!curRange) {
                                curRange = {
                                    start: i,
                                    end: i,
                                };
                                chunksMissing.push(curRange);
                            } else {
                                if (i - 1 == curRange.end) {
                                    curRange.end = i;
                                } else {
                                    curRange = {
                                        start: i,
                                        end: i,
                                    };
                                    chunksMissing.push(curRange);
                                }
                            }
                        }
                    }
                    if (chunksMissing.length != 0) {
                        //console.log("CHUNKS MISSING:", chunksMissing);
                        PoolManager.sendFileRequestToPool(fileDownload.poolID, fileDownload.fileInfo, fileDownload.isMedia, chunksMissing);
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
        if (APP_TYPE == 'desktop' || this.fileOffers.has(poolID) || !this.webworkerAccess) return Promise.resolve();
        return this.webworker.exec('getPoolFileOffers', poolID).then(async (fileOffers: PoolFile[]) => {
            let poolFileOffers = this.fileOffers.get(poolID);
            if (!poolFileOffers) {
                poolFileOffers = new Map<string, PoolFile>();
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
                poolFileOffers.set(fileOffers[i].fileInfo.fileId, fileOffers[i]);
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
            poolFileOffers = new Map<string, PoolFile>();
            this.fileOffers.set(poolID, poolFileOffers);
        }
        if (!poolFileOffers.has(fileInfo.fileId)) {
            let poolFile: PoolFile = {
                fileInfo,
                file: file,
            };
            poolFileOffers.set(fileInfo.fileId, poolFile);
            if (APP_TYPE == 'desktop' && this.webworkerAccess) {
                this.webworker.exec('addPoolFileOffer', {
                    poolID: poolID,
                    fileOffer: poolFile,
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

    getFileOffer(poolID: string, fileID: string): PoolFile | undefined {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return undefined;
        return poolFileOffers.get(fileID);
    }

    removeFileOffer(poolID: string, fileID: string) {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return;
        let fileOffer = poolFileOffers.get(fileID);
        if (!fileOffer) return;
        poolFileOffers.delete(fileID);
        if (APP_TYPE == 'desktop' && this.webworkerAccess) {
            this.webworker.exec('removePoolFileOffer', {
                poolID: poolID,
                fileID: fileID,
            });
        }
    }

    getFileOffers(poolID: string): PoolFile[] | undefined  {
        let poolFileOffers = this.fileOffers.get(poolID);
        if (!poolFileOffers) return undefined;
        return Array.from(poolFileOffers.values());
    }

    async addFileDownload(poolID: string, poolKey: number, fileInfo: PoolFileInfo, isMedia: boolean): Promise<boolean> {
        if (!this.checkFileSizeLimit(fileInfo.totalSize)) return false;
        if (this.fileDownloads.has(fileInfo.fileId)) return true;
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
                fileHandle = await directoryHandle.getFileHandle(Date.now().toString() + "-" + fileInfo.fileName, {
                    create: true,
                } as FileSystemGetFileOptions);
                fileStream = await fileHandle.createWritable();
            } catch (e) {
                console.log(e);
                alert("Error with chosen export folder");
                return false;
            }
        } else {
            this.currentFileDownloadSize += fileInfo.totalSize;
        }
        let chunksDownloadedMap = [];
        let totalChunks = Math.ceil(fileInfo.totalSize / CHUNK_SIZE);
        chunksDownloadedMap[totalChunks - 1] = false;
        let fileDownload: FileDownload = {
            poolID: poolID,
            poolKey: poolKey,
            fileInfo: fileInfo,
            lastModified: Date.now(),
            status: PoolDownloadProgressStatus.DOWNLOADING,
            totalChunks: totalChunks,
            chunksDownloaded: 0,
            chunksDownloadedMap: chunksDownloadedMap,
            directoryHandle: directoryHandle,
            isMedia: isMedia,
            lastRequestedNodeID: "",
            lastProgress: 0,
            retryCount: 0,
            hinterNodeIDs: undefined,
            fileHandle: fileHandle,
            fileStream: fileStream,
            memoryChunks: fileStream ? undefined : new Uint8Array(fileInfo.totalSize),
        };
        this.fileDownloads.set(fileInfo.fileId, fileDownload);
        this.startFileDownloadTimer();
        console.log("Downloading...", Date.now());
        let addDownloadAction: AddDownloadAction = {
            key: poolKey,
            fileInfo: fileInfo,
        };
        store.dispatch(poolAction.addDownload(addDownloadAction));
        return true;
    }

    getFileDownloadProgress(fileID: string): number {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return 0;
        return Math.trunc((fileDownload.chunksDownloaded / fileDownload.totalChunks) * 100);
    }

    hasFileDownload(fileID: string): boolean {
        return this.fileDownloads.has(fileID);
    }

    getFileDownload(fileID: string): FileDownload | undefined {
        return this.fileDownloads.get(fileID);
    }

    getFileDownloadInfo(fileID: string): PoolFileInfo | undefined {
        return this.fileDownloads.get(fileID)?.fileInfo;
    }

    getFileDownloadStatus(fileID: string): PoolDownloadProgressStatus {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return PoolDownloadProgressStatus.UNAVAILABLE;
        return fileDownload.status;
    }

    addFileChunk(fileID: string, chunkNumber: number, chunk: Uint8Array) {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return;
        if (fileDownload.chunksDownloadedMap[chunkNumber] == true) {
            console.log("ALREADY RECEIVED", chunkNumber);
            return;
        }

        // console.log("ADDING FILE CHUNK", chunkNumber);

        if (fileDownload.status != PoolDownloadProgressStatus.DOWNLOADING) {
            fileDownload.status = PoolDownloadProgressStatus.DOWNLOADING;
        }

        let offset = chunkNumber * CHUNK_SIZE;
        if (!fileDownload.isMedia && this.fileSystemAccess) {
            fileDownload.fileStream?.write({ type: "write", position: offset, data: chunk }).catch((e) => {
                this.completeFileDownload(fileID)
            });
        } else {
            fileDownload.memoryChunks?.set(chunk, offset);
        }

        fileDownload.lastModified = Date.now();
        fileDownload.chunksDownloadedMap[chunkNumber] = true;
        fileDownload.chunksDownloaded++;

        if (fileDownload.chunksDownloaded == fileDownload.totalChunks) {
            this.completeFileDownload(fileID);
        }
    }
    
    completeFileDownload(fileID: string) {
        let fileDownload = this.fileDownloads.get(fileID);
        if (!fileDownload) return;
        let successful = fileDownload.chunksDownloaded == fileDownload.totalChunks;
        console.log("Completed file download...", fileID, successful, Date.now());
        if (!fileDownload.isMedia && this.fileSystemAccess) {
            if (successful) {
                fileDownload.fileStream?.close().then(() => {            
                    fileDownload?.fileHandle?.getFile().then((file) => {
                        if (!fileDownload) return;
                        PoolManager.sendFileOfferToPool(fileDownload.poolID, file, fileDownload.fileInfo.fileId, fileDownload.fileInfo.originNodeId);
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
            this.currentFileDownloadSize -= fileDownload.fileInfo.totalSize;
            if (successful) {
                let blob = new Blob([fileDownload.memoryChunks]);
                if (fileDownload.isMedia) {
                    this.addMediaCache(fileID, blob);
                } else {
                    this.downloadFile(fileDownload.fileInfo.fileName, blob);
                }
            }
            fileDownload.memoryChunks = undefined;
        }

        store.dispatch(poolAction.removeDownload({
            key: fileDownload!.poolKey,
            fileID: fileDownload!.fileInfo.fileId,
        } as RemoveDownloadAction))
        
        this.fileDownloads.delete(fileID);
    }

    cacheFileChunk(fileID: string, chunkNumber: number, totalSize: number, chunk: Uint8Array) {
        if (!this.webworkerAccess) return;
        if (!this.cacheChunkFlushTimer) this.startCacheChunksFlushTimer();

        // console.log("Adding cache file chunk", chunkNumber);

        // Writing the actual files should take the seek penalty
        // Caching file chunks shouldn't
        // This is because you need complete cache chunks anyways
            // VERY IMPORTANT, becuase then let's say you miss some chunks
            // If some other node has those chunks, their chunks might be in very different places
            // BENCHMARK seek read seek read PERFORMANCE
        // So writing to file doesn't make sense if you aren't sure it gives you the full cacheChunk
        // Might need to reconsider caching system...
            // Inefficient, because if you start like multiple chunk ranges at once,
                // And have no way of predicting whether the chunk will arrive or not,
            // either store ALL of it in memory until complete, and then write,
            // or read but seek every time for every chunk
                // Benchmark 1000s of seek and read vs sequential read
                // Also benchmark seek and write vs sequential write
            // also UNORDERED IS A MUST (helps a lot with network congestion)

        // SOLUTION:
            // Keep cacheFileChunk logic as it is
            // Change the whole idea of cache chunks to "cache range IN cache chunk"
            // This is to facilitate the implementation in Rust, as they have to opportunity-
            // to seek and write to one LARGE cache file, it can be on another thread but just one thread
        let cacheChunkNumber = getCacheChunkNumberFromChunkNumber(chunkNumber);

        let cacheChunkMapData = this.cacheChunkMap.get(fileID);
        if (cacheChunkMapData) {
            let existingChunkRanges = cacheChunkMapData.get(cacheChunkNumber)?.chunkRanges;
            if (existingChunkRanges && existsInChunkRanges(chunkNumber, existingChunkRanges)) return;
        }

        let cacheChunk = this.fileCacheChunks.get(fileID);
        if (!cacheChunk) {
            cacheChunk = {
                lastModified: Date.now(),
                cacheChunkNumber: cacheChunkNumber,
                chunkRange: {
                    start: chunkNumber,
                    end: chunkNumber,
                },
                chunks: [chunk],
            }
            this.fileCacheChunks.set(fileID, cacheChunk);
        } else {
            cacheChunk.lastModified = Date.now();
            if (cacheChunk.cacheChunkNumber == cacheChunkNumber) {
                if (chunkNumber == cacheChunk.chunkRange.end + 1) {
                    cacheChunk.chunks.push(chunk);
                    cacheChunk.chunkRange.end = cacheChunk.chunkRange.end + 1;
                } else if (inChunkRange(chunkNumber, cacheChunk.chunkRange)) {
                    return;
                } else if (chunkNumber % CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR == 0) {
                    cacheChunk.chunkRange = {
                        start: chunkNumber,
                        end: chunkNumber,
                    }
                    cacheChunk.chunks = [ chunk ];
                } 
            } else {
                cacheChunk.cacheChunkNumber = cacheChunkNumber;
                cacheChunk.chunkRange = {
                    start: chunkNumber,
                    end: chunkNumber,
                }
                cacheChunk.chunks = [ chunk ];
            }
        }

        if (cacheChunk.chunks.length == CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR) {
            this.flushCacheChunk(fileID, cacheChunk);
        } else if (cacheChunk.chunkRange.end == chunkNumber && chunkNumber == Math.ceil(totalSize / CHUNK_SIZE) - 1) {
            //console.log("LAST CHUNK")
            this.flushCacheChunk(fileID, cacheChunk);
        }

    }

    flushCacheChunk(fileID: string, cacheChunk: CacheChunk) {
        this.fileCacheChunks.delete(fileID);

        // console.log("Flushing cache chunk", cacheChunk.cacheChunkNumber, cacheChunk.chunkRange);

        let key = Date.now() + ":" + cacheChunk.cacheChunkNumber.toString() + ":" + fileID;

        let deleteKey: string | undefined = undefined;
        if (this.cacheChunkQueue.length >= this.maxCacheChunkCount) {
            deleteKey = this.cacheChunkQueue.shift();
            if (deleteKey != undefined && deleteKey != "") {
                this.deleteKeyFromCacheChunkMap(deleteKey);
            }
            //console.log("DELETING CACHE CHUNK KEY:", deleteKey);
        }
        
        this.webworker.exec('putCacheChunk', {
            chunks: cacheChunk.chunks,
            key: key,
            deleteKey: deleteKey,
        }).then((success: boolean) => {
            if (success) {
                let cacheChunkMapData = this.cacheChunkMap.get(fileID);
        
                if (!cacheChunkMapData) {
                    cacheChunkMapData = new Map<number, CacheChunkData>();
                    this.cacheChunkMap.set(fileID, cacheChunkMapData);
                }

                let existingCacheChunkData = cacheChunkMapData.get(cacheChunk.cacheChunkNumber);
                if (!existingCacheChunkData) {
                    existingCacheChunkData = {
                        key: key,
                        chunkRanges: [],
                    }
                    cacheChunkMapData.set(cacheChunk.cacheChunkNumber, existingCacheChunkData);
                    this.cacheChunkQueue.push(key);
                }
                
                addToChunkRanges(cacheChunk.chunkRange, existingCacheChunkData.chunkRanges);
            }
        });
    }

    deleteKeyFromCacheChunkMap(key: string) {
        let split = key.split(':');
        let fileID: string = split[2];
        let cacheChunkNumber = parseInt(split[1]);
        let data = this.cacheChunkMap.get(fileID);
        if (data) {
            data.delete(cacheChunkNumber);
        }
    }

    getCacheChunk(key: string): Promise<Uint8Array[] | undefined> {
        let split = key.split(':');
        let data = this.cacheChunkMap.get(split[2]);
        if (data) {
            let cacheChunkNumber = parseInt(split[1]);
            if (data.has(cacheChunkNumber)) {
                return this.webworker.exec('getCacheChunk', key).then((ab: any) => {
                    if (!ab) {
                        this.deleteKeyFromCacheChunkMap(key);
                        return undefined;
                    }
                    return ab;
                });
            }
        }
        return Promise.resolve(undefined);
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

    getCacheChunkMapData(fileID: string): Map<number, CacheChunkData> | undefined {
        return this.cacheChunkMap.get(fileID);
    }

}