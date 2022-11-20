import { SSNodeStatusData, SSReportCodes, SSReportNodeData, SSSDPData, SSStatus, SSMessage, SSDisconnectData } from "./sync-server.model";
import { PoolNodeState, Pool, PoolUpdateLatestInfo, PoolMessage, PoolMessageType, PoolNode, PoolMessageAction, PoolFileInfo, PoolUpdateNodeState, PoolFileRequest, PoolMessageSourceInfo, PoolMessageDestinationInfo, MESSAGE_ID_LENGTH, FILE_ID_LENGTH, PoolMessageInfo, PoolChunkRange, PoolImageInfo, PoolDownloadProgressStatus, PoolRequestMediaHint } from "./pool.model";
import { getStoreState, store } from "../store/store";
import { AddActiveNodeAction, AddDownloadAction, AddFileOfferAction, AddMessageAction, PoolAction, poolAction, RemoveActiveNodeAction, RemoveFileOfferAction, SetMediaURLAction, UpdateActiveNodesAction, UpdateDownloadProgressStatusAction } from "../store/slices/pool.slice";
import { CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CHUNK_SIZE, DEFAULT_RECV_MESSAGES_CACHE, MAXIMUM_GET_LATEST_MESSAGE_LENGTH } from "../config/caching";
import { nanoid } from "nanoid";
import { createBinaryMessage, parseBinaryMessage, setBinaryMessageDestVisited } from "./pool-binary-message";
import { FileManager, PoolManager } from "./global";
import { SendSSMessage } from "./sync-server-client";
import { compactChunkRanges, getCacheChunkNumberFromByteSize, getCacheChunkNumberFromChunkNumber, searchPosInCacheChunkMapData } from "./pool-chunks";
import { CacheChunkData, CacheChunkMapData, FileOffer } from "./pool-file-manager";
import { mebibytesToBytes } from "../helpers/file-size";
import EventEmitter from "events";
import { Image } from 'image-js';
import { checkFileExist } from "../helpers/file-exists";

const MAXIMUM_DC_BUFFER_SIZE = mebibytesToBytes(15);
const PREVIEW_IMAGE_DIMENSION = 10;
const MAX_FILE_REQUEST_RETRY = 3;
const DC_BUFFER_AVAILABLE_TO_FILL_NAME = "available-to-fill";
const LOW_BUFFER_THRESHOLD = MAXIMUM_DC_BUFFER_SIZE / CHUNK_SIZE;

interface BasicNode {
    NodeID: string;
    UserID: string;
}

// interface DataChannelBufferObject {
//     msgID: string;
//     data: Uint8Array;
//     emitSent: boolean;
//     inQueue?: string[]; // dest nodeID
// }

interface NodeConnection {
    position: number;
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
}

interface NodePosition {
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodes: BasicNode[][];
    ChildClusterNodes: BasicNode[][];
}

interface FileRequest extends PoolFileRequest {
    startChunkNumber: number;
    wrappedAround: boolean;
    nextChunkNumber: number;
    chunksMissingRangeNumber: number;
    cacheChunksSet: Set<number>;
    cancelled: boolean;
}

interface AvailableFile {
    totalSize: number;
    seederNodeIDs: string[];
    lastRequestedNodeID: string;
    lastProgress: number;
    retryCount: number;
}

export class PoolClient {
    poolID: string;
    poolKey: number;
    ws: WebSocket;
    nodeID: string;
    nodePosition: NodePosition;
    nodeConnections: Map<string, NodeConnection>;
    lastPromoted: number;
    reconnect: boolean;
    new: boolean;
    latest: boolean;
    receivedMessages: PoolMessageInfo[];
    activeNodes: Map<string, number[]>; // key: nodeID, value: lastSeenPath
    availableFiles: Map<string, AvailableFile>; // key: fileID, value: availableFile
    mediaHinterNodeIDs: Map<string, string[]>; // key: fileID, value: hinterNodeIDs
    curFileRequests: Map<string, FileRequest[]>;
    sendingCache: boolean;
    sendCacheMap: Map<string, string[]>; // key: cacheChunkKey // value: dests 
    sendCacheQueue: CacheChunkData[]; // value: cacheChunkKey
    maxDCBufferQueueLength: number;
    curDCBufferQueueLength: number;
    DCBufferQueues: Uint8Array[][]; // size: 15
    DCBufferQueueEventEmitter: EventEmitter;
    panelSwitches: boolean[][];

    constructor(poolID: string, poolKey: number, ws: WebSocket) {
        this.poolID = poolID;
        this.poolKey = poolKey;
        this.ws = ws;
        this.nodeID = "";
        this.nodePosition = {} as NodePosition;
        this.nodeConnections = new Map<string, NodeConnection>();
        this.lastPromoted = Date.now();
        this.reconnect = true;
        this.new = true;
        this.latest = false;
        this.receivedMessages = [];
        this.activeNodes = new Map<string, number[]>;
        this.availableFiles = new Map<string, AvailableFile>;
        this.mediaHinterNodeIDs = new Map<string, string[]>;
        this.curFileRequests = new Map<string, FileRequest[]>;
        this.sendingCache = false;
        this.sendCacheMap = new Map<string, string[]>;
        this.sendCacheQueue = [];
        this.maxDCBufferQueueLength = store.getState().setting.storageSettings.maxSendBufferSize / CHUNK_SIZE;
        this.curDCBufferQueueLength = 0;
        this.DCBufferQueues = [];
        this.initDataChannelBufferQueues();
        this.DCBufferQueueEventEmitter = new EventEmitter();
        this.panelSwitches = [[false, false, false], [false, false]]
    }

    ////////////////////////////////////////////////////////////////
    // Basic helpers functions
    ////////////////////////////////////////////////////////////////

    getPool(): Pool {
        return getStoreState().pool.pools[this.poolKey]
    }

    getPanelNumber() {
        return this.nodePosition.Path[this.nodePosition.Path.length - 1]
    }

    disconnectFromPool() {
        this.reconnect = false;
        this.ws.close();
    }

    closeNodeConnection(nodeConnection: NodeConnection) {
        nodeConnection.connection.close();
        nodeConnection.dataChannel?.close();
    }

    clean() {
        this.nodeConnections.forEach((nodeConn) => {
            this.closeNodeConnection(nodeConn)
        });
        this.curFileRequests.forEach((fileRequest) => {
            for (let i = 0; i < fileRequest.length; i++) {
                fileRequest[i].cancelled = true;
            }
        });
        this.nodeConnections.clear();
        this.availableFiles.clear();
        this.curFileRequests.clear();

        if (!this.reconnect) {
            let dq = this.getPool().downloadQueue;
            for (let i = 0; i < dq.length; i++) {
                FileManager.completeFileDownload(dq[i].fileID);
            }
            store.dispatch(poolAction.clearPool({
                key: this.poolKey,
            } as PoolAction))
        }
    }

    ////////////////////////////////////////////////////////////////
    // Node setup functions
    ////////////////////////////////////////////////////////////////

    updateNodePosition(nodePosition: NodePosition, myNodeID: string) {
        this.nodePosition = nodePosition;
        this.nodeID = myNodeID;
        console.log(this.nodePosition);
        this.lastPromoted = Date.now();
        this.checkForEmptyBufferQueues();
        if (this.new) {
            let profileState = getStoreState().profile;
            let fileOffers: FileOffer[] = FileManager.getFileOffers(this.poolID) || [];
            let poolFileInfos: PoolFileInfo[] = fileOffers.map((fileOffer) => {
                return {
                    ...fileOffer,
                    file: undefined,
                };
            });
            store.dispatch(poolAction.resetPool({
                key: this.poolKey,
                self: true,
                node: {
                    nodeID: this.nodeID,
                    userID: profileState.userID,
                    state: PoolNodeState.ACTIVE,
                    lastSeenPath: this.nodePosition.Path,
                    deviceType: profileState.deviceType,
                    deviceName: profileState.deviceName,
                    fileOffers: poolFileInfos,
                } as PoolNode,
            } as AddActiveNodeAction));
            console.log("NodeID", this.nodeID)
            this.new = false;

            if (nodePosition.CenterCluster) {
                let onlyNode = true;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (nodePosition.ParentClusterNodes[i][j].NodeID != "" && nodePosition.ParentClusterNodes[i][j].NodeID != this.nodeID) {
                            onlyNode = false;
                            break;
                        }
                    }
                    if (!onlyNode) break;
                }
                if (onlyNode) {
                    this.latest = true;
                    this.addActiveNode(this.createMessage(PoolMessageType.SIGNAL_STATUS, PoolMessageAction.DEFAULT, this.getPool().myNode));
                }
            }
        }
    }

    getOffer(targetNodeID: string): Promise<string> {
        let resolve: (value: string | PromiseLike<string>) => void;
        let reject: (reason?: any) => void
        let promise = new Promise<string>((res, rej) => {
            resolve = res;
            reject = rej;
        })

        if (this.nodeConnections.has(targetNodeID)) {
            this.closeNodeConnection(this.nodeConnections.get(targetNodeID)!);
            this.nodeConnections.delete(targetNodeID);
        }

        let position = this.getPosition(targetNodeID);
        if (position == undefined) {
            reject!();
            return promise;
        }

        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);
        
        let nodeConnection: NodeConnection = {
            position: position,
            connection: connection,
            dataChannel: dataChannel,
        };

        this.nodeConnections.set(targetNodeID, nodeConnection);
    
        this.setDataChannelFunctions(nodeConnection, targetNodeID, true);
        
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            resolve(JSON.stringify(connection.localDescription));
        }
    
        connection.createOffer().then((d) => connection.setLocalDescription(d)).catch(() => reject());

        return promise;
    }

    answerOffer(targetNodeID: string, sdpOffer: SSSDPData): Promise<string> {
        let resolve: (value: string | PromiseLike<string>) => void;
        let reject: (reason?: any) => void;
        let promise = new Promise<string>((res, rej) => {
            resolve = res;
            reject = rej;
        })

        if (this.nodeConnections.has(targetNodeID)) {
            this.closeNodeConnection(this.nodeConnections.get(targetNodeID)!);
            this.nodeConnections.delete(targetNodeID);
        }

        let position = this.getPosition(targetNodeID);
        if (position == undefined) {
            reject!();
            return promise;
        }

        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);

        let nodeConnection: NodeConnection = {
            position: position,
            connection: connection,
            dataChannel: dataChannel,
        };
    
        this.nodeConnections.set(targetNodeID, nodeConnection);
    
        this.setDataChannelFunctions(nodeConnection, targetNodeID, false);
    
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            resolve(JSON.stringify(connection.localDescription));
        }
    
        connection.setRemoteDescription(JSON.parse(sdpOffer.SDP)).then(() => {
            connection.createAnswer().then((d) => connection.setLocalDescription(d)).catch(() => reject())
        }).catch(() => reject());
    
        return promise;
    }

    connectNode(targetNodeID: string, sdpAnswer: SSSDPData): Promise<void> {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        let resolve: (value: void | PromiseLike<void>) => void;
        let reject: (reason?: any) => void
        let promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
            if (!nodeConnection) {
                reject();
            }
        })

        if (!nodeConnection) {
            return promise;
        }

        nodeConnection.dataChannel.addEventListener('open', (e) => resolve());
        nodeConnection.connection.setRemoteDescription(JSON.parse(sdpAnswer.SDP)).catch(() => reject());

        return promise;
    }

    disconnectNode(targetNodeID: string, disconnectData: SSDisconnectData) {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        if (nodeConnection){
            this.closeNodeConnection(nodeConnection);
            this.nodeConnections.delete(targetNodeID);
        }
        if (disconnectData.RemoveFromPool) {
            this.sendInactiveNodeSignal(targetNodeID);
        }
    }

    verifyConnection(msg: SSMessage): boolean {
        let nodeConnection = this.nodeConnections.get(msg.TargetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            return false;
        }
        return true;
    }

    ////////////////////////////////////////////////////////////////
    // Send to pool functions
    ////////////////////////////////////////////////////////////////

    sendActiveNodeSignal(nodeID: string) {
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.SIGNAL_STATUS, PoolMessageAction.DEFAULT, this.getPool().myNode)));
    }

    sendInactiveNodeSignal(nodeID: string) {
        let userID = "";
        for (const node of this.getPool().activeNodes) {
            if (node.nodeID == nodeID) {
                userID = node.userID;
                break;
            }
        }
        this.handleMessage(this.createMessage(PoolMessageType.SIGNAL_STATUS, PoolMessageAction.DEFAULT, {
            nodeID: nodeID,
            userID: userID,
            state: PoolNodeState.INACTIVE,
        } as PoolUpdateNodeState));
    }

    sendGetLatest(nodeID: string) {
        let pool = this.getPool();
        let lastMessageID: string = "";
        let messages: PoolMessage[] = [];
        if (this.latest) {
            for (let i = pool.messages.length - 1; i >= 0; i--) {
                if (pool.messages[i].received != undefined && pool.messages[i].received! < this.lastPromoted) {
                    lastMessageID = pool.messages[i].msgID; 
                    break;
                } else {
                    messages.push(pool.messages[i]);
                }
            }
        }
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, PoolMessageAction.REQUEST, {
            messagesOnly: !this.latest ? false : pool.activeNodes.length != 0 ? false : true,
            lastMessageID: lastMessageID,
            messages: lastMessageID != "" ? messages : [],
        } as PoolUpdateLatestInfo, nodeID)));
    }

    sendRespondGetLatest(nodeID: string, latestRequest: PoolUpdateLatestInfo) {
        let pool = this.getPool();
        let correctedActiveNodes: PoolNode[] = [];
        let messagesOnly = latestRequest.messagesOnly;
        let lastMessageID = latestRequest.lastMessageID;

        if (lastMessageID != "") {
            this.addMessages(latestRequest.messages)
        }

        if (!messagesOnly) {
            correctedActiveNodes = pool.activeNodes.slice();
            correctedActiveNodes.push(pool.myNode);
        }
        let latest: PoolUpdateLatestInfo = {
            messagesOnly: messagesOnly,
            lastMessageID: lastMessageID,
            activeNodes: messagesOnly ? [] : correctedActiveNodes,
            messages: [],
        }
        
        if (lastMessageID == "") {
            latest.messages = pool.messages.slice(-MAXIMUM_GET_LATEST_MESSAGE_LENGTH);
        } else {
            let i = pool.messages.length - 1;
            for (; i >= 0; i--) {
                if (pool.messages[i].msgID == lastMessageID) {
                    break;
                }
            }
            if (i == -1) {
                latest.lastMessageID = "";
                latest.messages = pool.messages;
            } else {
                latest.messages = pool.messages.slice(i + 1);
            }
        }
        //console.log(correctedActiveNodes);
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, PoolMessageAction.REPLY, latest, nodeID)))
    }

    sendTextMessage(text: string) {
        this.handleMessage(this.createMessage(PoolMessageType.TEXT, PoolMessageAction.DEFAULT, text))
    }

    sendFileOffer(file: File, fileID: string = nanoid(FILE_ID_LENGTH), originNodeID: string = this.nodeID) {
        let fileInfo: PoolFileInfo = {
            fileID: fileID,
            nodeID: this.nodeID,
            originNodeID: originNodeID,
            fileName: file.name,
            totalSize: file.size,
        };
        if (!FileManager.addFileOffer(this.poolID, fileInfo, file)) return;
        this.handleMessage(this.createMessage(PoolMessageType.FILE, PoolMessageAction.DEFAULT, fileInfo));
    }
    
    async sendImageOffer(file: File) {
        if (file.size > this.getPool().PoolSettings.maxMediaSize) {
            this.sendFileOffer(file);
            return;
        }
        let fileID: string = nanoid(FILE_ID_LENGTH);
        let image = await Image.load(await file.arrayBuffer());
        let width = image.width;
        let height = image.height;
        let format = file.name.split('.')[file.name.split('.').length - 1];
        if (width < height) {
            image = image.resize({
                width: PREVIEW_IMAGE_DIMENSION,
            })
        } else {
            image = image.resize({
                height: PREVIEW_IMAGE_DIMENSION,
            })
        }
        let previewImage = "data:image/" + format + ";base64," + await image.toBase64();
        let fileInfo: PoolFileInfo = {
            fileID: fileID,
            nodeID: this.nodeID,
            originNodeID: this.nodeID,
            fileName: file.name,
            totalSize: file.size,
        };
        if (!FileManager.addFileOffer(this.poolID, fileInfo, file)) return;
        FileManager.addMediaCache(fileID, file);
        this.handleMessage(this.createMessage(PoolMessageType.IMAGE, PoolMessageAction.DEFAULT, {
            fileInfo: {
                fileID: fileID,
                nodeID: this.nodeID,
                originNodeID: this.nodeID,
                fileName: file.name,
                totalSize: file.size,
            } as PoolFileInfo,
            extension: format,
            width: width,
            height: height,
            previewImage: previewImage,
        } as PoolImageInfo));
        this.sendMedia(fileID);
    }

    async sendRequestFile(fileInfo: PoolFileInfo, isMedia: boolean, chunksMissing?: PoolChunkRange[], hinterNodeID?: string) {
        if (FileManager.hasFileOffer(this.poolID, fileInfo.fileID)) {
            let exists = await this.validateFileOffer(fileInfo.fileID);
            if (exists) return;
        }

        // if (!availableFile) {
        //     FileManager.completeFileDownload(fileInfo.fileID);
        //     return;   
        // }

        // if (chunksMissing.length == 0) {
        //     let dq = this.getPool().downloadQueue;
        //     let shouldBeInQueue = inQueue;
        //     if (!shouldBeInQueue) {
        //         for (let i = 0; i < dq.length; i++) {
        //             if (dq[i].fileID == fileInfo.fileID) {
        //                 return;
        //             }
        //         }
        //         shouldBeInQueue = dq.length != 0;
        //         if (!(await FileManager.addFileDownload(this.poolID, this.poolKey, fileInfo, isMedia))) return;
        //         store.dispatch(poolAction.addDownload({
        //             key: this.poolKey,
        //             fileInfo: fileInfo,
        //         } as AddDownloadAction));
        //     } else {
        //         shouldBeInQueue = false;
        //     }
        //     if (shouldBeInQueue) return;
        // }

        if (!FileManager.hasFileDownload(fileInfo.fileID)) {
            if (!(await FileManager.addFileDownload(this.poolID, this.poolKey, fileInfo, isMedia))) return;
            let addDownloadAction: AddDownloadAction = {
                key: this.poolKey,
                fileInfo: fileInfo,
            };
            store.dispatch(poolAction.addDownload(addDownloadAction));
        } 


        let availableFile = this.availableFiles.get(fileInfo.fileID);
        
        //console.log(availableFile, fileInfo.fileID);
        let requestNodeID = "";
        if (availableFile) {
            if (availableFile.seederNodeIDs.length == 1) {
                requestNodeID = availableFile.seederNodeIDs[0];
            } else {
                let minimumDist = Infinity;
                for (let i = 0; i < availableFile.seederNodeIDs.length; i++) {
                    let lsp = this.activeNodes.get(availableFile.seederNodeIDs[i]);
                    if (!lsp) continue;
                    let dist = this.getDistanceTo(lsp);
                    if (dist < minimumDist) {
                        requestNodeID = availableFile.seederNodeIDs[i];
                        minimumDist = dist;
                    }
                }
            }

            if (requestNodeID != "") {
                if (requestNodeID == availableFile.lastRequestedNodeID && availableFile.retryCount > MAX_FILE_REQUEST_RETRY) {
                    let updateDownloadStatusAction: UpdateDownloadProgressStatusAction = {
                        key: this.poolKey,
                        fileID: fileInfo.fileID,
                        status: PoolDownloadProgressStatus.RETRYING,
                    };
                    store.dispatch(poolAction.updateDownloadProgressStatus(updateDownloadStatusAction));
                    this.removeAvailableFileOffer(fileInfo.fileID, requestNodeID);
                    this.sendRequestFile(fileInfo, isMedia, chunksMissing);
                    return;
                }
    
                let progress = FileManager.getFileDownloadProgress(fileInfo.fileID);
                if (availableFile.lastRequestedNodeID == requestNodeID && availableFile.lastProgress == progress) {
                    availableFile.retryCount++;
                } else {
                    availableFile.retryCount = 0;
                }
                
                availableFile.lastRequestedNodeID = requestNodeID;
                availableFile.lastProgress = progress;
            }
        }

        if (isMedia && requestNodeID == "") {
            let nodeIDs = this.mediaHinterNodeIDs.get(fileInfo.fileID);
            //console.log(nodeIDs);
            if (!hinterNodeID && nodeIDs) {
                if (nodeIDs.length == 0 || nodeIDs.length == 1) { // no response from hints, should remove from queue to prevent sending automatic hints again 
                    this.mediaHinterNodeIDs.delete(fileInfo.fileID);
                    FileManager.completeFileDownload(fileInfo.fileID);
                    return;
                }
                nodeIDs.splice(0, 1);
            }
            if (!nodeIDs) {
                nodeIDs = [];
                this.mediaHinterNodeIDs.set(fileInfo.fileID, nodeIDs);
            }
            if (hinterNodeID) {
                nodeIDs.push(hinterNodeID);
                if (nodeIDs.length != 1) return;
            }
            if (nodeIDs.length > 0) {
                requestNodeID = nodeIDs[0];
            }
        }

        if (requestNodeID != "") {
            let updateDownloadStatusAction: UpdateDownloadProgressStatusAction = {
                key: this.poolKey,
                fileID: fileInfo.fileID,
                status: PoolDownloadProgressStatus.DOWNLOADING,
            };
            store.dispatch(poolAction.updateDownloadProgressStatus(updateDownloadStatusAction));

            let fileRequest: PoolFileRequest = {
                fileID: fileInfo.fileID,
                requestingNodeID: this.nodeID,
                chunksMissing: chunksMissing || [],
                cacheChunksCovered: [],
            };

            if (FileManager.hasMediaCache(fileInfo.fileID)) {
                this.sendFile(fileRequest);
            } else {
                for (let i = 0; i < 3; i++) {
                    this.handleMessage(this.createMessage(PoolMessageType.FILE, PoolMessageAction.REQUEST, fileRequest, requestNodeID, i));
                }
            }
        } else {
            //FileManager.completeFileDownload(fileInfo.fileID);
            let updateDownloadStatusAction: UpdateDownloadProgressStatusAction = {
                key: this.poolKey,
                fileID: fileInfo.fileID,
                status: PoolDownloadProgressStatus.UNAVAILABLE,
            };
            store.dispatch(poolAction.updateDownloadProgressStatus(updateDownloadStatusAction));
            if (isMedia) {
                this.sendDefaultMediaHint(fileInfo);
            }
        }
    }

    sendDefaultMediaHint(fileInfo: PoolFileInfo) {
        let requestingHintData: PoolRequestMediaHint = {
            fileInfo: fileInfo,
        };
        this.handleMessage(this.createMessage(PoolMessageType.REQUEST_MEDIA_HINT, PoolMessageAction.DEFAULT, requestingHintData));
    }

    sendReplyMediaHint(originNodeID: string, requestingHintData: PoolRequestMediaHint) {
        if (!FileManager.hasMediaCache(requestingHintData.fileInfo.fileID)) return;
        this.handleMessage(this.createMessage(PoolMessageType.REQUEST_MEDIA_HINT, PoolMessageAction.REPLY, requestingHintData, originNodeID));
    }

    sendRequestMediaFromHint(hinterNodeID: string, requestingHintData: PoolRequestMediaHint) {
        if (!FileManager.hasFileDownload(requestingHintData.fileInfo.fileID)) return;
        this.sendRequestFile(requestingHintData.fileInfo, true, undefined, hinterNodeID);
    }

    ////////////////////////////////////////////////////////////////
    // Send chunk functions
    ////////////////////////////////////////////////////////////////

    sendChunk(fileID: string, chunkNumber: number, chunk: ArrayBuffer, dests: PoolMessageDestinationInfo[] | undefined, partnerIntPath: number, nextChunk?: () => any) {
        if (!this.reconnect) return;
        let hasMyNode = false;
        if (dests) {
            for (let i = dests.length - 1; i >= 0; i--) {
                dests[i].visited = false;
                if (dests[i].nodeID == this.nodeID) {
                    //console.log("ADDING FILE CHUNK", chunkNumber);
                    FileManager.addFileChunk(fileID, chunkNumber, chunk);
                    hasMyNode = true;
                } else if (!this.activeNodes.has(dests[i].nodeID)) {
                    console.log("ACTIVE NODE NO LONGER ACTIVE", this.activeNodes)
                    dests.splice(i, 1);
                }
            }
            if (dests.length == 0 || (dests.length == 1 && hasMyNode)) {
                if (nextChunk) nextChunk();
                return;
            }
        }
        let src: PoolMessageSourceInfo = this.getSrc();
        //console.log("sending chunk", chunkNumber, dests);
        this.broadcastMessage(createBinaryMessage(chunk, fileID, chunkNumber, src, dests), src, dests, this.nodeID, partnerIntPath);
        if (!this.checkBufferQueueFree()) {
            // console.log("CHUNK IS WAITING");
            // EVNET EMITTER?
            this.DCBufferQueueEventEmitter.once(DC_BUFFER_AVAILABLE_TO_FILL_NAME, () => {
                console.log("FINALLY SENDING CHUNK", chunkNumber);
                if (nextChunk) nextChunk();
            })
        } else {
            if (nextChunk) nextChunk();
        }
    }

    async sendFile(poolFileRequest: PoolFileRequest) {
        let fileSource: File | Blob;

        if (FileManager.hasFileOffer(this.poolID, poolFileRequest.fileID)) {
            let exists = await this.validateFileOffer(poolFileRequest.fileID);
            if (!exists && !FileManager.hasMediaCache(poolFileRequest.fileID)) return;
        } else if (!FileManager.hasMediaCache(poolFileRequest.fileID)) return;

        if (poolFileRequest.chunksMissing.length != 0) {
            compactChunkRanges(poolFileRequest.chunksMissing);
        }

        //console.log("pass", poolFileRequest.cacheChunksCovered);

        let fileRequest: FileRequest = poolFileRequest as FileRequest;
        let concFileRequests = this.curFileRequests.get(poolFileRequest.fileID);
        if (!concFileRequests) {
            fileRequest.nextChunkNumber = 0;
            fileRequest.wrappedAround = false;
            fileRequest.chunksMissingRangeNumber = 0;
            fileRequest.cacheChunksSet = new Set<number>(fileRequest.cacheChunksCovered);
            fileRequest.cancelled = false;
            concFileRequests = [fileRequest];
            this.curFileRequests.set(fileRequest.fileID, concFileRequests);

            if (FileManager.hasFileOffer(this.poolID, poolFileRequest.fileID)) {
                fileSource = FileManager.getFileOffer(this.poolID, poolFileRequest.fileID)!.file;
                if (poolFileRequest.requestingNodeID != this.nodeID && !this.activeNodes.has(poolFileRequest.requestingNodeID)) return;    
            } else if (FileManager.hasMediaCache(poolFileRequest.fileID)) {
                let mediaObjectURL = FileManager.getMediaCache(poolFileRequest.fileID)!;
                fileSource = await (await fetch(mediaObjectURL)).blob();
            }
        } else {
            for (let i = 0; i < concFileRequests.length; i++) {
                if (concFileRequests[i].requestingNodeID == fileRequest.requestingNodeID) {
                    for (let j = 0; j < fileRequest.cacheChunksCovered.length; j++) {
                        concFileRequests[i].cacheChunksSet!.add(fileRequest.cacheChunksCovered[j]);
                    }
                    return;
                }
            }
            fileRequest.nextChunkNumber = 0;
            fileRequest.wrappedAround = false;
            fileRequest.chunksMissingRangeNumber = 0;
            fileRequest.cacheChunksSet = new Set<number>(fileRequest.cacheChunksCovered);
            fileRequest.cancelled = false;
            concFileRequests.push(fileRequest);
            return;
        }

        let chunkNumber = 0;
        let partnerIntPath = 0;
        let totalChunks = Math.ceil(fileSource!.size / CHUNK_SIZE);
        let destNodeIDs: string[]; // UPDATE DEST EERY TIME NEXT CHUNK IS DONE, SO fileReader.onload doesn't need to check again

        let fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            if (e.target?.error != null) {
                this.removeFileOffer(fileRequest.fileID);
            }
            if (!e.target) return;
            if (!FileManager.hasFileOffer(this.poolID, poolFileRequest.fileID) && !FileManager.hasMediaCache(poolFileRequest.fileID)) return;
            partnerIntPath = getCacheChunkNumberFromChunkNumber(chunkNumber) % 3;
            this.sendChunk(fileRequest.fileID, chunkNumber++, e.target.result as ArrayBuffer, this.getDests(destNodeIDs), partnerIntPath, nextChunk);
        }

        let nextChunk = () => {
            //console.log("next chunk");
            if (!concFileRequests) return;
            if (chunkNumber >= totalChunks) {
                chunkNumber = 0;
                for (let i = 0; i < concFileRequests.length; i++) {
                    concFileRequests[i].wrappedAround = true;
                    concFileRequests[i].nextChunkNumber = 0;
                    concFileRequests[i].chunksMissingRangeNumber = 0;
                }
            }

            let minNextChunkNumber = Infinity;
            for (let i = concFileRequests.length - 1; i >= 0; i--) {
                let req = concFileRequests[i];
                if (req.cancelled || !this.activeNodes.has(req.requestingNodeID)) {
                    concFileRequests.splice(i, 1);
                    continue;
                }
                if (req.startChunkNumber == undefined) {
                    req.startChunkNumber = chunkNumber;
                    req.nextChunkNumber = chunkNumber;
                }
                if (req.nextChunkNumber > chunkNumber) {
                    if (req.nextChunkNumber < minNextChunkNumber) {
                        destNodeIDs = [req.requestingNodeID];
                        minNextChunkNumber = req.nextChunkNumber;
                    } else if (req.nextChunkNumber == minNextChunkNumber) {
                        destNodeIDs.push(req.requestingNodeID);
                    }
                    continue;
                } else {
                    req.nextChunkNumber = chunkNumber;
                }
                if (req.chunksMissing.length != 0) {
                    do {
                        if (req.nextChunkNumber >= totalChunks) break;
                        if (req.nextChunkNumber < req.chunksMissing[req.chunksMissingRangeNumber][0]) {
                            req.nextChunkNumber = req.chunksMissing[req.chunksMissingRangeNumber][0];
                        } else if (req.nextChunkNumber > req.chunksMissing[req.chunksMissingRangeNumber][1]) {
                            do {
                                req.chunksMissingRangeNumber++;
                                if (req.chunksMissingRangeNumber >= req.chunksMissing.length) {
                                    req.nextChunkNumber = totalChunks;
                                    break;
                                }
                                if (req.nextChunkNumber <= req.chunksMissing[req.chunksMissingRangeNumber][1]) {
                                    if (req.chunksMissing[req.chunksMissingRangeNumber][0] > req.nextChunkNumber) {
                                        req.nextChunkNumber = req.chunksMissing[req.chunksMissingRangeNumber][0];
                                    }
                                    break;
                                }
                            } while (true);
                        }
                        let cacheChunkNumber = getCacheChunkNumberFromChunkNumber(req.nextChunkNumber);
                        if (!req.cacheChunksSet.has(cacheChunkNumber)) break;
                        req.nextChunkNumber = (cacheChunkNumber + 1) * CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR;
                    } while (true);
                } else {
                    while (req.nextChunkNumber < totalChunks) {
                        if (req.cacheChunksSet.has(getCacheChunkNumberFromChunkNumber(req.nextChunkNumber))) {
                            req.nextChunkNumber += CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR;
                        } else {
                            break;
                        }
                    }
                }
                if (req.wrappedAround && req.nextChunkNumber >= req.startChunkNumber) {
                    //console.log(req);
                    concFileRequests.splice(i, 1);
                    continue;
                }
                if (req.nextChunkNumber < minNextChunkNumber) {
                    destNodeIDs = [req.requestingNodeID];
                    minNextChunkNumber = req.nextChunkNumber;
                } else if (req.nextChunkNumber == minNextChunkNumber) {
                    destNodeIDs.push(req.requestingNodeID);
                }
            }

            if (concFileRequests.length == 0) {
                this.curFileRequests.delete(fileRequest.fileID);
                //console.log("DELETING", concFileRequests, this.curFileRequests);
                return;
            }
            
            chunkNumber = minNextChunkNumber;
            if (chunkNumber >= totalChunks) {
                nextChunk();
                return;
            }
            let offset = chunkNumber * CHUNK_SIZE;
            fileReader.readAsArrayBuffer(fileSource.slice(offset, offset + CHUNK_SIZE))
        }

        console.log("SENDING FILE");
        nextChunk();
    }

    sendMedia(fileID: string) {
        let fileOffer: FileOffer | undefined = FileManager.getFileOffer(this.poolID, fileID);
        if (!fileOffer) return;

        let chunkNumber = 0;
        let partnerIntPath = 0;
        let totalChunks = Math.ceil(fileOffer.file.size / CHUNK_SIZE);

        let fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            if (e.target?.error != null) {
                this.removeFileOffer(fileID);
            }
            if (!e.target) return;
            if (!FileManager.hasFileOffer(this.poolID, fileID) && !FileManager.hasMediaCache(fileID)) return;
            partnerIntPath = getCacheChunkNumberFromChunkNumber(chunkNumber) % 3;
            this.sendChunk(fileID, chunkNumber++, e.target.result as ArrayBuffer, undefined, partnerIntPath, nextChunk);
        }

        let nextChunk = () => {
            if (chunkNumber >= totalChunks) return;
            let offset = chunkNumber * CHUNK_SIZE;

            fileReader.readAsArrayBuffer(fileOffer!.file.slice(offset, offset + CHUNK_SIZE));
        } 

        console.log("SENDING MEDIA");
        nextChunk();
    }

    addToSendCache(cacheChunkData: CacheChunkData, destNodeID: string) {
        let existingSendCache = this.sendCacheMap.get(cacheChunkData.key);
        if (!existingSendCache) {
            existingSendCache = [];
            this.sendCacheMap.set(cacheChunkData.key, existingSendCache);
            this.sendCacheQueue.push(cacheChunkData);
        }
        existingSendCache.push(destNodeID);
        if (!this.sendingCache) this.startSendCacheChunks();
    }

    startSendCacheChunks() {
        this.sendingCache = true;
        let nextCacheChunk = async () => {
            if (this.sendCacheQueue.length == 0 || !this.reconnect) {
                console.log("END SEND CACHE")
                this.sendingCache = false;
                return;
            }
            let cacheChunkData = this.sendCacheQueue[0];
            let cacheChunk = await FileManager.getCacheChunk(cacheChunkData.key);
            this.sendCacheQueue.shift();
            let destIDs = this.sendCacheMap.get(cacheChunkData.key);
            this.sendCacheMap.delete(cacheChunkData.key);
            if (!cacheChunk) {
                // POSSIBLE TO SEND REQUEST FOR THESE CHUNKS ON BEHALF?
                console.log("NO CACHECHUNK", cacheChunkData.key);
                nextCacheChunk();
                return;
            }
            let hasMyNode = false;
            if (destIDs) {
                for (let i = destIDs.length - 1; i >= 0; i--) {
                    // if (destIDs[i] == this.nodeID) {
                    //     hasMyNode = true;
                    //     destIDs.splice(i, 1);
                    // } else 
                    if (!this.activeNodes.has(destIDs[i])) {
                        destIDs.splice(i, 1);
                    }
                }
            }
            if (!destIDs || (destIDs.length == 0 && !hasMyNode)) {
                nextCacheChunk();
                return;
            }

            let i = 0;
            let chunkNumber = 0;
            let fileID = cacheChunkData.key.split(':')[2];
            let dests = this.getDests(destIDs);
            // console.log("SENDING CACHECHUNK NUMBER", cacheChunkData.cacheChunkNumber);
            let nextChunk = () => {
                // console.log("NEXTCHUNK", j);
                if (i >= cacheChunk.length || (dests.length == 0 && !hasMyNode)) {
                    nextCacheChunk();
                    // console.log("NEXT CACHE CHUNK");
                    return;
                }

                chunkNumber = (cacheChunkData.cacheChunkNumber * CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR) + i;
                i++
                // if (hasMyDest) {
                //     FileManager.addFileChunk(fileID, chunkNumber, cacheChunk[i - 1]);
                //     if (dests.length == 0) nextChunk();
                // }
                // if (dests.length != 0) {
                //     this.sendChunk(fileID, chunkNumber, cacheChunk[i - 1], dests, this.nodePosition.PartnerInt, nextChunk);
                // }
                this.sendChunk(fileID, chunkNumber, cacheChunk[i - 1], dests, this.nodePosition.PartnerInt, nextChunk);
            }
            nextChunk();
        }

        console.log("START SEND CACHE");
        nextCacheChunk();
    }

    addAndSendChunksCovered(poolFileRequest: PoolFileRequest, partnerIntPath: number) {
        if (!this.availableFiles.has(poolFileRequest.fileID)) return;
        if (partnerIntPath != this.nodePosition.PartnerInt && poolFileRequest.requestingNodeID != this.nodeID) return;
        if (FileManager.hasMediaCache(poolFileRequest.fileID)) {
            let totalSize = this.availableFiles.get(poolFileRequest.fileID)!.totalSize;
            console.log(getCacheChunkNumberFromByteSize(totalSize));
            for (let i = 0; i <= getCacheChunkNumberFromByteSize(totalSize); i++) {
                if (i % 3 != partnerIntPath) {
                    poolFileRequest.cacheChunksCovered.push(i);
                }
            }
            console.log(poolFileRequest.cacheChunksCovered, partnerIntPath);
            this.sendFile(poolFileRequest);
        } else {
            // I argue that even if it's only like [1000, 1001] for chunks missing, you should send whole cache
            // Becuase then, the nodes will have the full cache
            let cacheChunkMapData = FileManager.cacheChunkMap.get(poolFileRequest.fileID);
            if (!cacheChunkMapData) return;
            let cacheChunks = new Set<number>(poolFileRequest.cacheChunksCovered);
            if (poolFileRequest.chunksMissing.length == 0) {
                for (let i = 0; i < cacheChunkMapData.length; i++) {
                    if (cacheChunkMapData[i].cacheChunkNumber % 3 == partnerIntPath && !cacheChunks.has(cacheChunkMapData[i].cacheChunkNumber)) {
                        this.addToSendCache(cacheChunkMapData[i], poolFileRequest.requestingNodeID);
                        poolFileRequest.cacheChunksCovered.push(cacheChunkMapData[i].cacheChunkNumber);
                    }
                }
            } else {
                for (let i = 0; i < poolFileRequest.chunksMissing.length; i++) {
                    let start = getCacheChunkNumberFromChunkNumber(poolFileRequest.chunksMissing[i][0]);
                    let end = getCacheChunkNumberFromChunkNumber(poolFileRequest.chunksMissing[i][1]);
                    for (let j = start; j <= end; j++) {
                        if (!cacheChunks.has(j)) {
                            let pos = searchPosInCacheChunkMapData(cacheChunkMapData, j);
                            if (pos >= 0) {
                                this.addToSendCache(cacheChunkMapData[pos], poolFileRequest.requestingNodeID);
                                poolFileRequest.cacheChunksCovered.push(j);
                                cacheChunks.add(j);
                            }
                        }
                    }
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage helper functions
    ////////////////////////////////////////////////////////////////

    addAvailableFileOffer(fileOffer: PoolFileInfo) {
        let availableFile = this.availableFiles.get(fileOffer.fileID);
        //console.log("ADDING AVAILABLE FILE");
        if (!availableFile) {
            availableFile = {
                totalSize: fileOffer.totalSize,
                seederNodeIDs: [],
                lastRequestedNodeID: "",
                lastProgress: 0,
                retryCount: 0,
            };
            this.availableFiles.set(fileOffer.fileID, availableFile);
        } else if (fileOffer.totalSize != availableFile.totalSize) return;
        if (!availableFile.seederNodeIDs.includes(fileOffer.nodeID)) {
            availableFile.seederNodeIDs.push(fileOffer.nodeID);
            store.dispatch(poolAction.addFileOffer({
                key: this.poolKey,
                fileOffer: fileOffer,
            } as AddFileOfferAction));
        }
    }

    removeAvailableFileOffer(fileID: string, nodeID: string) {
        let availableFile = this.availableFiles.get(fileID);
        if (!availableFile) return;
        for (let i = 0; i < availableFile.seederNodeIDs.length; i++) {
            if (availableFile.seederNodeIDs[i] == nodeID) {
                availableFile.seederNodeIDs.splice(i, 1);
                store.dispatch(poolAction.removeFileOffer({
                    key: this.poolKey,
                    fileID: fileID,
                    nodeID: nodeID,
                } as RemoveFileOfferAction));
                break;
            }
        }
        if (availableFile.seederNodeIDs.length == 0) this.availableFiles.delete(fileID);
    }

    removeFileOffer(fileID: string) {
        // SEND RETRACT FILE OFFER
            // removeAvailableFileOffer will happen in handleMessage
        this.removeAvailableFileOffer(fileID, this.nodeID); // TEMPORARY
        FileManager.removeFileoffer(this.poolID, fileID);
    }

    validateFileOffer(fileID: string): Promise<boolean> {
        let fileOffer = FileManager.getFileOffer(this.poolID, fileID);
        if (!fileOffer) {
            return Promise.resolve(false);
        }
        return checkFileExist(fileOffer.file).then((exists) => {
            if (!exists) {
                this.removeFileOffer(fileID);
            }
            return exists;
        });
    }

    updateLatest(updateLatestInfo: PoolUpdateLatestInfo) {
        this.addMessages(updateLatestInfo.messages);
        if (!updateLatestInfo.messagesOnly) {
            this.activeNodes.clear();
            this.availableFiles.clear();
            for (let i = 0; i < updateLatestInfo.activeNodes.length; i++) {
                let node = updateLatestInfo.activeNodes[i];
                this.activeNodes.set(node.nodeID, node.lastSeenPath);
                for (let j = 0; j < node.fileOffers.length; j++) {
                    this.addAvailableFileOffer(node.fileOffers[j]);
                }
            }
        }
        if (!updateLatestInfo.messagesOnly) {
            store.dispatch(poolAction.updateActiveNodes({
                key: this.poolKey,
                activeNodes: updateLatestInfo.activeNodes,
            } as UpdateActiveNodesAction));
        }
        this.latest = true;
    }

    addActiveNode(msg: PoolMessage) {
        //console.log("ADDING ACTIVE NODE");
        let node: PoolNode = msg.data
        if (this.activeNodes.has(node.nodeID)) return;
        this.activeNodes.set(node.nodeID, node.lastSeenPath);
        this.addMessage(msg);
        if (node.nodeID != this.nodeID) {
            for (let i = 0; i < node.fileOffers.length; i++) {
                this.addAvailableFileOffer(node.fileOffers[i]);
            }
            //let d = 0;
            store.dispatch(poolAction.addActiveNode({
                key: this.poolKey,
                node: node,
            } as AddActiveNodeAction));
        }
    }

    removeActiveNode(msg: PoolMessage) {
        let nodeID: string = msg.data.nodeID;
        if (!this.activeNodes.has(nodeID)) return;
        this.activeNodes.delete(nodeID);
        let existingNode: PoolNode | undefined = undefined;
        for (const node of this.getPool().activeNodes) {
            if (node.nodeID == nodeID) {
                existingNode = node;
                break;
            }
        }
        if (existingNode) {
            for (let i = 0; i < existingNode.fileOffers.length; i++) {
                this.removeAvailableFileOffer(existingNode.fileOffers[i].fileID, nodeID);
                // FileManager.completeFileDownload(existingNode.fileOffers[i].fileID);
            }
            // this.curFileRequests.forEach((requests, fileID) => {
            //     for (let i = 0; i < requests.length; i++) {
            //         if (requests[i].requestingNodeID == nodeID) {
            //             requests[i].cancelled = true;
            //         }
            //     }
            // })
        }
        this.addMessage(msg);
        store.dispatch(poolAction.removeActiveNode({
            key: this.poolKey,
            nodeID: nodeID,
        } as RemoveActiveNodeAction));
    }

    completeFileDownload(fileID: string) {
        this.mediaHinterNodeIDs.delete(fileID);
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage functions
    ////////////////////////////////////////////////////////////////

    handleMessage(msg: PoolMessage, fromNodeID: string = this.nodeID) {
        let pool = this.getPool();
        if (this.checkMessageDuplicate(msg)) return;

        console.log("MSG RECV:", JSON.stringify(msg));

        if (msg.src.nodeID != this.nodeID) {
            if (this.activeNodes.has(msg.src.nodeID)) {
                this.activeNodes.set(msg.src.nodeID, msg.src.path);
            }
        }

        //let isADest = false;

        if (msg.dests) {
            if (this.checkAtMyDest(msg.dests)) {
                switch (msg.type) {
                case PoolMessageType.GET_LATEST:
                    if (msg.action == PoolMessageAction.REQUEST) {
                        this.sendRespondGetLatest(msg.src.nodeID, msg.data);
                    } else if (msg.action == PoolMessageAction.REPLY) {
                        this.updateLatest(msg.data);
                    }
                    break;
                case PoolMessageType.FILE:
                    if (msg.action == PoolMessageAction.REQUEST) {
                        this.sendFile(msg.data);
                    }
                    break;
                case PoolMessageType.REQUEST_MEDIA_HINT:
                    if (msg.action == PoolMessageAction.REPLY) {
                        this.sendRequestMediaFromHint(msg.src.nodeID, msg.data);
                    }
                }
                if (msg.dests.length == 1) return;
                //isADest = true;
            } else {
                switch (msg.type) {
                case PoolMessageType.GET_LATEST:
                    break;
                case PoolMessageType.FILE:
                    if (msg.action == PoolMessageAction.REQUEST) {
                        if (msg.partnerIntPath != null) {
                            this.addAndSendChunksCovered(msg.data, msg.partnerIntPath);
                        }
                    }
                    break;
                case PoolMessageType.REQUEST_MEDIA_HINT:
                    break;
                default:
                    return
                }
            }
        } else {
            switch (msg.type) {
            case PoolMessageType.SIGNAL_STATUS:
                if (msg.data.state == PoolNodeState.ACTIVE) {
                    this.addActiveNode(msg);
                } else if (msg.data.state == PoolNodeState.INACTIVE) {
                    this.removeActiveNode(msg);
                } else {
                    return
                }
                break;
            case PoolMessageType.TEXT:
                if (msg.data == "" || msg.data.length >= pool.PoolSettings.maxTextLength || msg.data.replaceAll(" ", "").replaceAll("&nbsp;", "").replaceAll("<br>", "") == "") {
                    return
                }
                this.addMessage(msg);
                break;
            case PoolMessageType.FILE:
                this.addAvailableFileOffer(msg.data);
                if (msg.data.nodeID == msg.data.originNodeID) {
                    this.addMessage(msg);
                }
                break;
            case PoolMessageType.IMAGE:
                if (msg.data.totalSize > this.getPool().PoolSettings.maxMediaSize) return;
                this.addAvailableFileOffer(msg.data.fileInfo);
                if (msg.src.nodeID != this.nodeID) {
                    msg.data.mediaURL = undefined;
                    FileManager.addFileDownload(this.poolID, this.poolKey, msg.data.fileInfo, true);
                    let addDownloadAction: AddDownloadAction = {
                        key: this.poolKey,
                        fileInfo: msg.data.fileInfo,
                    };
                    store.dispatch(poolAction.addDownload(addDownloadAction));
                }
                this.addMessage(msg);
                //this.sendRequestFile(msg.data.fileInfo, [], false, true);
                break;
            case PoolMessageType.REQUEST_MEDIA_HINT:
                if (msg.action == PoolMessageAction.DEFAULT) {
                    this.sendReplyMediaHint(msg.src.nodeID, msg.data);
                }
                break;
            default:
                return
            }
        }
        
        let data = JSON.stringify(msg);
        this.broadcastMessage(data, msg.src, msg.dests, fromNodeID, msg.partnerIntPath);
    }

    async handleBinaryMessage(binaryData: ArrayBuffer, fromNodeID: string = this.nodeID) {
        let data = new Uint8Array(binaryData);

        let parsedMsg = parseBinaryMessage(data)
        if (!parsedMsg) return; //report

        let [ payload, fileID, chunkNumber, src, dests ] = parsedMsg;

        if (payload.byteLength == 0) return;
        let fileSize = this.availableFiles.get(fileID)?.totalSize;

        // 1 step/8mb buffer: 46,272ms
        // 3 steps/8mb buffer/1.6mb cache chunk: 82,475ms
        // 3 steps/16mb buffer/1.6mb cache chunk: 76,214ms (WILL SOMETIMES STUTTER DUE TO 16 MB BUFFER)
        // 3 steps/16mb buffer/16mb cache chunk: 166,008ms (stutter)
        // 3 steps/16mb buffer/160KB cache chunk: 112,690ms (stutter)
        // 3 steps/15mb buffer/1.6mb cache chunk: 76,611ms (SEEMS LIKE BEST OPTION (roughly))
        // 3 steps/15mb buffer/16mb cache chunk: 79,512ms
        // 3 steps/15mb buffer/160KB cache chunk: 76,818ms
        // 3 steps/15mb buffer/15mb cache chunk: 77,322ms
        // 3 steps/15mb buffer/8mb cache chunk: 75,714ms (this will be problematic with like 3 files, as it will easily block)
        // 3 steps/15mb buffer/1mb cache chunk: 76,611ms (This is best OPTION) (!)

        // NO PROMISES:
        // 1 step/15mb buffer: 34,287ms
        // 3 steps/15mb buffer/16KB cache chunk: 77,032ms
        // 3 steps/15mb buffer/128KB cache chunk: 77,439ms, 77,423ms, 76,578ms
        // 3 steps/15mb buffer/1mb cache chunk: 75,470ms, 76,969ms, 77,495ms
        // Yeah the cache chunk sizes don't affect it that much, so 1mb cache chunk seems pretty good

        // FIRST CACHE:
        // Same panel, 1 node: 50,470ms
        // 2 nodes, different panel, 1 parent cluster: 124,821ms
        // 8 nodes, all different panel, 1 parent cluster: 247,406ms
        // 26 nodes, 2 levels: 771,152ms

        // CACHING IN EFFECT (same travel distance as first cache):
        // Same panel, 1 node: 21,146ms
        // 2 nodes, different panel, 1 parent cluster: 43,186ms
        // 8 nodes, all different panel, 1 parent cluster: 164,994ms
        // 26 nodes, 2 levels: 490,083ms

        // FIRST CACHE (Webworkers):
        // Same panel, 1 node: 46,877ms
        // 2 nodes, different panel, 1 parent cluster: 69,181ms
        // 26 nodes, 2 levels: 704,035ms

        // CACHING IN EFFECT (Webworkers):
        // Same panel, 1 node: 21,968ms
        // 8 nodes, all different panel, 1 parent cluster: 99,866ms
        // 26 nodes, 2 levels: 392,552ms

        // MAIN CASES TO TEST
        // Center Cluster, all request
        // Request from Child node in seperate child cluster
        // Center Cluster, remove nodes: [2, 3, 4, 5, 7, 9] 1 node in each panel, different partnerInt
        // Center Cluster, remove nodes: [1, 2, 5, 6, 7, 8] 1 node in one panel, 2 nodes in other panel, different partnerInt
        // 1 Child node to Center Cluster

        // console.log("BINARY MSG RECV:", payload.byteLength, msgID, fileID, chunkNumber, dests);
        // console.log("FORWARD CHUNKNUMBER", chunkNumber)

        //let isADest = false;
        let partnerIntPath = getCacheChunkNumberFromChunkNumber(chunkNumber) % 3;
        if (dests) {
            let forwardMessage = true;
            if (this.checkAtMyDest(dests)) {
                FileManager.addFileChunk(fileID, chunkNumber, payload);
                if (dests.length != 1) {
                    // if (partnerIntPath != this.nodePosition.PartnerInt) console.log("GOT MY FILE CHUNK, SENDING TO DESTS", dests) // Problem, is it's sending to other panels of a partnerInt that is not itself
                    //isADest = true;
                    //data = createBinaryMessage(payload, msgID, fileID, chunkNumber, src, dests);
                    setBinaryMessageDestVisited(data, parsedMsg, this.nodeID);
                } else {
                    forwardMessage = false;
                }
            }

            if (partnerIntPath == this.nodePosition.PartnerInt && fileSize) {
                FileManager.cacheFileChunk(fileID, chunkNumber, fileSize, payload)
            }

            if (!forwardMessage) return;

        } else {
            FileManager.addFileChunk(fileID, chunkNumber, payload);
        }
        
        this.broadcastMessage(data, src, dests, fromNodeID, partnerIntPath);
    }

    ////////////////////////////////////////////////////////////////
    // Data channel functions
    ////////////////////////////////////////////////////////////////

    broadcastMessage(data: string | Uint8Array, src: PoolMessageSourceInfo, dests: PoolMessageDestinationInfo[] | undefined, fromNodeID: string, partnerIntPath: number | null = null) {
        let panelNumber = this.getPanelNumber();
        let sent = false;
        let restrictToOwnPanel = partnerIntPath != null && src.nodeID != this.nodeID && partnerIntPath != this.nodePosition.PartnerInt;

        //if (typeof data == 'string') console.log("MSG SEND", data);
        // console.log("DC SEND")

        if (dests) {
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID;
                if (i != this.nodePosition.PartnerInt && nodeID != "") {
                    //if (partnerIntPath == null || (i == partnerIntPath && !isADest)) {
                    if (partnerIntPath == null || (i == partnerIntPath && nodeID != fromNodeID)) {
                        this.sendDataChannel(nodeID, data);
                        sent = true;
                        break;
                    } 
                }
            }

            if (partnerIntPath != null && sent) return;

            // ///////////// DO WE NEED THIS??? IF WE REMOVE DATA
            // let parentClusterDirection: PoolMessageDestinationInfo[][] = [[], [], []]; 
            // let childClusterDirection: PoolMessageDestinationInfo[][] = [[], []];
            

            // let modifiedDests = false;
            // for (let destIndex = dests.length - 1; destIndex >= 0; destIndex--) {
            //     for (let i = 0; i < 3; i++) {
            //         let b = false;
            //         for (let j = 0; j < 3; j++) {
            //             let nodeID = this.nodePosition.ParentClusterNodes[i][j].NodeID;
            //             if (nodeID != "" && nodeID != this.nodeID && nodeID == dests[destIndex].nodeID) {
            //                 //parentClusterDirection[i].push(dests[destIndex]);
            //                 // if (!modifiedDests) dests = dests.slice();
            //                 // modifiedDests = true;
            //                 // dests.splice(destIndex, 1);
            //                 if (i == panelNumber && j != this.nodePosition.PartnerInt) {
            //                     if (partnerIntPath == null || this.nodePosition.PartnerInt == partnerIntPath || this.nodePosition.ParentClusterNodes[panelNumber][partnerIntPath].NodeID == "" || partnerIntPath == j) {
            //                         this.sendDataChannel(nodeID, data);
            //                     }
            //                 } else {
            //                     this.panelSwitches[0][i] = true;                                
            //                 }
            //                 b = true;
            //                 break;
            //             }
            //         }
            //         if (b) break;
            //     }
            // }

            //console.log(partnerIntPath, this.nodePosition.PartnerInt, dests, parentClusterDirection, panelNumber)


            // MOVE ABOVE
                // since this sends individually to dataChannel anyways and by definition will never send twice to same dataChannel
                // due to dests having only unique nodeID
            // if (parentClusterDirection[panelNumber].length != 0) {
            //     for (let i = 0; i < 3; i++) {
            //         if (i != this.nodePosition.PartnerInt) {
            //             if (partnerIntPath != null && this.nodePosition.PartnerInt != partnerIntPath && this.nodePosition.ParentClusterNodes[panelNumber][partnerIntPath].NodeID != "" && partnerIntPath != i) continue;
            //             for (let j = 0; j < parentClusterDirection[panelNumber].length; j++) {
            //                 if (parentClusterDirection[panelNumber][j].nodeID == this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID) {
            //                     this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID, data);
            //                     //break
            //                 }
            //             }
            //         }
            //     }
            // }

            // if (partnerIntPath != null) {
            //     if (src.nodeID != this.nodeID && partnerIntPath != this.nodePosition.PartnerInt) {
            //         // console.log("DIFF PARTNER INT")
            //         return;
            //     }
            // }

            // console.log("Sending to", partnerIntPath)

            // reset panel switches
            for (let i = 0; i < this.panelSwitches[0].length; i++) {
                this.panelSwitches[0][i] = false;
            }
            for (let i = 0; i < this.panelSwitches[1].length; i++) {
                this.panelSwitches[1][i] = false;
            }

            // Prevents right to send to any other panel if it's not source node and the message does not correspond to the partnerInt
            for (let destIndex = 0; destIndex < dests.length; destIndex++) {

                if (dests[destIndex].visited) continue;

                let found = false;
                for (let i = 0; i < 3; i++) {
                    if (restrictToOwnPanel && i != panelNumber) continue;
                    for (let j = 0; j < 3; j++) {
                        let nodeID = this.nodePosition.ParentClusterNodes[i][j].NodeID;
                        if (nodeID != "" && nodeID != this.nodeID && nodeID == dests[destIndex].nodeID) {
                            //parentClusterDirection[i].push(dests[destIndex]);
                            // if (!modifiedDests) dests = dests.slice();
                            // modifiedDests = true;
                            // dests.splice(destIndex, 1);
                            if (i == panelNumber && j != this.nodePosition.PartnerInt) {
                                // Sets boundaries to when it's allowed to send to its own panel
                                if (
                                    partnerIntPath == null || 
                                    this.nodePosition.PartnerInt == partnerIntPath || 
                                    partnerIntPath == j || 
                                    this.nodePosition.ParentClusterNodes[panelNumber][partnerIntPath].NodeID == ""
                                ) {
                                    //console.log("SENDING TO SAME PANEL:", nodeID);
                                    this.sendDataChannel(nodeID, data);
                                }
                            } else {
                                this.panelSwitches[0][i] = true;                                
                            }
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }

                if (found || restrictToOwnPanel) continue;

                let matches = 0;
                let srcDestMatches = 0;
                if (this.nodePosition.Path.length <= dests[destIndex].lastSeenPath.length) {
                    for (let i = 0; i < this.nodePosition.Path.length; i++) {
                        if (this.nodePosition.Path[i] == dests[destIndex].lastSeenPath[i]) {
                            matches++;
                        } else {
                            matches = 0;
                            break;
                        }
                    }
                    if (matches != 0) {
                        for (let i = 0; i < Math.min(src.path.length, dests[destIndex].lastSeenPath.length); i++) {
                            if (src.path[i] == dests[destIndex].lastSeenPath[i]) {
                                srcDestMatches++;
                            } else {
                                break;
                            }
                        }
                    }
                }

                if (matches == 0) {
                    if (this.nodePosition.CenterCluster) {
                        //if (this.sendToParentClusterPanel(dests[destIndex].lastSeenPath[0], data, partnerIntPath)) sent = true;
                        //parentClusterDirection[dests[destIndex].lastSeenPath[0]].push(dests[destIndex]);
                        this.panelSwitches[0][dests[destIndex].lastSeenPath[0]] = true;    
                    } else {
                        //if (this.sendToParentClusterPanel(2, data, partnerIntPath)) sent = true;
                        //parentClusterDirection[2].push(dests[destIndex]);
                        this.panelSwitches[0][2] = true;   
                    }
                } else {
                    if (matches != 1 && matches <= srcDestMatches) {
                        //if (this.sendToParentClusterPanel(2, data, partnerIntPath)) sent = true;
                        //parentClusterDirection[2].push(dests[destIndex]);
                        this.panelSwitches[0][2] = true;   
                    }
                    if (matches != dests[destIndex].lastSeenPath.length && matches >= srcDestMatches) {
                        //if (this.sendToChildClusterPanel(dests[destIndex].lastSeenPath[matches], data, partnerIntPath)) sent = true;
                        //childClusterDirection[dests[destIndex].lastSeenPath[matches]].push(dests[destIndex]);
                        this.panelSwitches[1][dests[destIndex].lastSeenPath[matches]] = true;   
                    }
                }
            }

            if (restrictToOwnPanel) return;

            let [sendToParent, sendToChild] = this.getDirectionOfMessage(src);
            if (sendToParent) {
                // for (let i = 0; i < parentClusterDirection.length; i++) {
                //     if (i != panelNumber && parentClusterDirection[i].length != 0) {
                //         if (this.sendToParentClusterPanel(i, data, partnerIntPath)) sent = true;
                //     }
                // }
                for (let i = 0; i < this.panelSwitches[0].length; i++) {
                    if (i != panelNumber && this.panelSwitches[0][i]) {
                        if (this.sendToParentClusterPanel(i, data, partnerIntPath)) sent = true;
                    }
                }
            }

            if (sendToChild) {  
                // for (let i = 0; i < childClusterDirection.length; i++) {
                //     if (childClusterDirection[i].length != 0) {
                //         if (this.sendToChildClusterPanel(i, data, partnerIntPath)) sent = true;
                //     }
                // }
                for (let i = 0; i < this.panelSwitches[1].length; i++) {
                    if (this.panelSwitches[1][i]) {
                        if (this.sendToChildClusterPanel(i, data, partnerIntPath)) sent = true;
                    }
                }
            }
        } else {
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID;
                if (i != this.nodePosition.PartnerInt && nodeID != "") {
                    if (
                        nodeID != fromNodeID && 
                        (
                            partnerIntPath == null || 
                            this.nodePosition.PartnerInt == partnerIntPath || 
                            partnerIntPath == i || 
                            this.nodePosition.ParentClusterNodes[panelNumber][partnerIntPath].NodeID == ""
                        )
                    ) {
                        this.sendDataChannel(nodeID, data);
                        sent = true;
                    } 
                }
            }

            //console.log(restrictToOwnPanel);

            if (restrictToOwnPanel) return;

            let [sendToParent, sendToChild] = this.getDirectionOfMessage(src);
 
            //console.log(sendToParent, sendToChild);

            if (sendToParent) {
                for (let i = 0; i < 3; i++) {
                    if (i != panelNumber) {
                        if (this.sendToParentClusterPanel(i, data, partnerIntPath)) sent = true;
                    }
                }
            }

            if (sendToChild) {
                for (let i = 0; i < 2; i++) {
                    if (this.sendToChildClusterPanel(i, data, partnerIntPath)) sent = true;
                }
            }
        }
    }
    
    private getDirectionOfMessage(src: PoolMessageSourceInfo): [boolean, boolean] {
        let sendToParent = false;
        let sendToChild = true;
        if (this.nodePosition.Path.length < src.path.length) {
            for (let i = 0; i < this.nodePosition.Path.length; i++) {
                if (this.nodePosition.Path[i] != src.path[i]) {
                    sendToParent = false;
                    sendToChild = true;
                    break;
                } else {
                    sendToParent = true;
                    sendToChild = false;
                }
            }
        } else if (this.nodePosition.Path.length == src.path.length && this.nodePosition.Path.every((v, i) => v == src.path[i])) {
            sendToParent = true;
            sendToChild = true;
        }
        return [sendToParent, sendToChild];
    }

    private setDataChannelFunctions(nodeConnection: NodeConnection, targetNodeID: string, sentOffer: boolean) {
        nodeConnection.dataChannel.binaryType = 'arraybuffer';
        nodeConnection.dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE;
        nodeConnection.dataChannel.onbufferedamountlow = () => {
            //console.log("LOW BUFFER, SENDING QUEUE OF SIZE,", this.DCBufferQueues[nodeConnection.position].length, targetNodeID);
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onopen = () => {
            console.log("DATA CHANNEL WITH", targetNodeID, "OPENED");
            this.sendActiveNodeSignal(targetNodeID);
            if (!this.latest) {
                this.sendGetLatest(targetNodeID);
            } else if (sentOffer) {
                let isNeighbourNode = false
                for (let i = 0; i < 3; i++) {
                    if (this.nodePosition.ParentClusterNodes[this.getPanelNumber()][i].NodeID == targetNodeID) {
                        isNeighbourNode = true;
                        break
                    }
                }
                if (isNeighbourNode) {
                    this.sendGetLatest(targetNodeID);
                }
            }
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onmessage = (e: MessageEvent<string | ArrayBuffer>) => {
            // console.log("DC RECV", e.data, e.type);
            // console.log("DC RECV FROM:", targetNodeID, e.data);
            if (typeof e.data == 'string') {
                if (e.data == "") return;
                let msg: PoolMessage = JSON.parse(e.data);
                if (msg.src.nodeID == this.nodeID) return;
                this.handleMessage(msg, targetNodeID);
            } else {
                // console.log("DC RECV ARRAY BUFFER FROM", targetNodeID);
                this.handleBinaryMessage(e.data as ArrayBuffer, targetNodeID);
            }
        }

        nodeConnection.dataChannel.onclose = (e) => {
            SendSSMessage(this.ws, 2006, { ReportCode: SSReportCodes.DISCONNECT_REPORT } as SSReportNodeData, undefined, targetNodeID);
            let src: PoolMessageSourceInfo = {
                nodeID: this.nodeID,
                path: this.nodePosition.Path,
            }
            let dataChannelBufferQueue = this.DCBufferQueues[nodeConnection.position];
            for (let i = 0; i < dataChannelBufferQueue.length; i++) {
                if (this.reconnect) {
                    // check if nodePosition has a node that is supposed to be there -> do nothing (else empty buffer queue)
                    // every updateNodePosition should update each bufferQueue if empty
                    // Think about whether emit/bufferObject is needed? Is there another way to manage buffers (like global "bufferOverloading paramater")
                    // Keep track of total buffer (add buffer and remove buffer should be controlled)
                    let replacedNode: BasicNode | undefined = this.getNodeFromPosition(nodeConnection.position);
                    if (replacedNode && replacedNode.NodeID != "" && replacedNode.NodeID != targetNodeID) {
                        let replacedNodeConnection = this.nodeConnections.get(replacedNode.NodeID);
                        if (replacedNodeConnection) {
                            this.flushDCBufferQueue(replacedNodeConnection);
                        }
                    }
                    //this.broadcastMessage(nodeConnection.dataChannelBufferQueue[i], src, nodeConnection.dataChannelBufferQueue[i].resendDests, nodeConnection.dataChannelBufferQueue[i].isADest, this.nodePosition.PartnerInt);
                }
            }
        }
    }

    private sendDataChannel(nodeID: string, data: string | Uint8Array): boolean {
        if (nodeID == "") return false;
        let nc = this.nodeConnections.get(nodeID);
        if (!nc) return false;
        if (nc.dataChannel.readyState == 'open') {
            //console.log("DC SEND", nodeID, typeof data == 'string' ? data : "ARRAY BUFFER");
            if (typeof data != 'string') {
                if (nc.dataChannel.bufferedAmount >= MAXIMUM_DC_BUFFER_SIZE || !this.checkBufferQueueIsEmpty(nc.position)) {
                    //console.log("BUFFER SIZE", nc.dataChannel.bufferedAmount, MAXIMUM_DC_BUFFER_SIZE);
                    this.addToDCBufferQueue(nc.position, data);
                    return true;
                }
                //console.log("DC SEND BUFFER")
                nc.dataChannel.send(data);
            } else {
                nc.dataChannel.send(data);
            }
            return true;
        } else if (nc.dataChannel.readyState == 'connecting') {
            if (typeof data != 'string') {
                //console.log("PUSHING BEFORE DC OPEN")
                this.addToDCBufferQueue(nc.position, data);
                return true
            }
        }
        return false;
    }

    private sendToParentClusterPanel(panelNumber: number, data: string | Uint8Array, partnerIntPath: number | null = null): boolean {
        let sent = false;
        if (partnerIntPath != null) {
            if (this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][partnerIntPath].NodeID, data)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID, data)) sent = true;
            if (partnerIntPath != null && sent) {
                return true;
            }
        }
        return sent;
    }

    private sendToChildClusterPanel(panelNumber: number, data: string | Uint8Array, partnerIntPath: number | null = null): boolean {
        let sent = false;
        if (partnerIntPath != null) {
            if (this.sendDataChannel(this.nodePosition.ChildClusterNodes[panelNumber][partnerIntPath].NodeID, data)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.ChildClusterNodes[panelNumber][i].NodeID, data)) sent = true;
            if (partnerIntPath != null && sent) {
                return true;
            }
        }
        return sent;
    }

    private getPosition(nodeID: string): number | undefined {
        let position = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ParentClusterNodes[i][j].NodeID == nodeID) {
                    return position;
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ChildClusterNodes[i][j].NodeID == nodeID) {
                    return position;
                }
                position++;
            }
        }
        return undefined; 
    }

    private getNodeFromPosition(position: number): BasicNode | undefined {
        let node: BasicNode;
        if (position < 9) {
            node = this.nodePosition.ParentClusterNodes[Math.floor(position/3)][position % 3];
        } else {
            position -= 9;
            node = this.nodePosition.ChildClusterNodes[Math.floor(position/3)][position % 3];
        }
        if (node.NodeID == "") {
            return undefined;
        }
        return node;
    }

    ////////////////////////////////////////////////////////////////
    // DataChannel Buffer Queue functions
    ////////////////////////////////////////////////////////////////

    private initDataChannelBufferQueues() {
        this.curDCBufferQueueLength = 0;
        for (let i = 0; i < 15; i++) {
            this.DCBufferQueues[i] = [];
        }
    }

    private addToDCBufferQueue(position: number, data: Uint8Array) {
        this.DCBufferQueues[position].push(data);
        this.curDCBufferQueueLength++;
        //console.log("ADDING TO BUFFER QUEUE", position, this.curDCBufferQueueLength, this.maxDCBufferQueueLength)
    }

    private checkForEmptyBufferQueues() {
        let position = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ParentClusterNodes[i][j].NodeID == "") {
                    this.curDCBufferQueueLength -= this.DCBufferQueues[position].length;
                    this.DCBufferQueues[position] = [];
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ChildClusterNodes[i][j].NodeID == "") {
                    this.curDCBufferQueueLength -= this.DCBufferQueues[position].length;
                    this.DCBufferQueues[position] = [];
                }
                position++;
            }
        }
        this.triggerDCBufferAvailableToFill();
    }

    private flushDCBufferQueue(nodeConnection: NodeConnection) {
        let i = 0
        let dataChannelBufferQueue = this.DCBufferQueues[nodeConnection.position];
        if (dataChannelBufferQueue.length == 0) return
        //console.log("FUSHING DC BUFFER QUEUE OF LENGTH", dataChannelBufferQueue.length, nodeConnection.position);
        for (; i < dataChannelBufferQueue.length; i++) {
            if (nodeConnection.dataChannel.bufferedAmount >= MAXIMUM_DC_BUFFER_SIZE) {
                break;
            }
            //console.log(nodeConnection.dataChannelBufferQueue[i].binaryData);
            nodeConnection.dataChannel.send(dataChannelBufferQueue[i]);
        }
        dataChannelBufferQueue.splice(0, i);
        this.curDCBufferQueueLength -= i;
        this.triggerDCBufferAvailableToFill();
    }

    private triggerDCBufferAvailableToFill() {
        //console.log("PRE TRIGGER DC BUFFER FILL", this.curDCBufferQueueLength, this.maxDCBufferQueueLength - LOW_BUFFER_THRESHOLD);
        if (this.curDCBufferQueueLength < this.maxDCBufferQueueLength - LOW_BUFFER_THRESHOLD) {
            //console.log("TRIGGER DC BUFFER FILL");
            this.DCBufferQueueEventEmitter.emit(DC_BUFFER_AVAILABLE_TO_FILL_NAME);
        }
    }

    private checkBufferQueueIsEmpty(position: number): boolean {
        return this.DCBufferQueues[position].length == 0; 
    }
 
    private checkBufferQueueFree(): boolean {
        //return this.curDCBufferQueueLength < 64;
        return this.curDCBufferQueueLength < this.maxDCBufferQueueLength;
    }

    ////////////////////////////////////////////////////////////////
    // PoolMessage helpers functions
    ////////////////////////////////////////////////////////////////

    private checkMessageDuplicate(msg: PoolMessage): boolean {
        let poolMessageExists: boolean = false;
        for (let i = this.receivedMessages.length - 1; i >= 0; i--) {
            if (msg.created && this.receivedMessages[i].received < msg.created) {
                break
            } else {
                if (this.receivedMessages[i].msgID == msg.msgID) {
                    poolMessageExists = true;
                }
            }
        }
        if (poolMessageExists) return true

        this.receivedMessages.push({
            msgID: msg.msgID,
            received: Date.now(),
        });
        if (this.receivedMessages.length > DEFAULT_RECV_MESSAGES_CACHE) {
            this.receivedMessages.shift();
        }

        return false;
    }

    private addMessage(message: PoolMessage) {
        store.dispatch(poolAction.addMessage({
            key: this.poolKey,
            message: message,
        } as AddMessageAction));
    }

    private addMessages(messages: PoolMessage[]) {
        for (let i = 0; i < messages.length; i++) {
            if (!this.checkMessageDuplicate(messages[i])) {
                if (messages[i].type == PoolMessageType.SIGNAL_STATUS) {
                    if (messages[i].data.state == PoolNodeState.ACTIVE) {
                        this.addActiveNode(messages[i]);
                    } else if (messages[i].data.state == PoolNodeState.INACTIVE) {
                        this.removeActiveNode(messages[i]);
                    }
                } else {
                    this.addMessage(messages[i]);
                }
            }
        }
    }

    private checkAtMyDest(dests: PoolMessageDestinationInfo[]): boolean {
        for (let i = 0; i < dests.length; i++) {
            if (dests[i].nodeID == this.nodeID) {
                return !dests[i].visited;
            }
        }
        return false;
    }

    private getSrc(): PoolMessageSourceInfo {
        return {
            nodeID: this.nodeID,
            path: this.nodePosition.Path,
        }
    }

    private getDests(destNodeIDs: string[] | string): PoolMessageDestinationInfo[] {
        if (typeof destNodeIDs == 'string') {
            destNodeIDs = [destNodeIDs]
        }
        let dests: PoolMessageDestinationInfo[] = [];
        for (let i = 0; i < destNodeIDs.length; i++) {
            let dest: PoolMessageDestinationInfo = {
                nodeID: destNodeIDs[i],
                lastSeenPath: this.activeNodes.get(destNodeIDs[i]) || [],
                visited: false,
            };
            dests.push(dest);
        }
        return dests
    }

    private createMessage(type: PoolMessageType, action: PoolMessageAction, data?: any, destNodeIDs?: string[] | string, partnerIntPath: number | null = null): PoolMessage {
        let src = this.getSrc();
        let dests = destNodeIDs ? this.getDests(destNodeIDs) : undefined;
        return {
            src: src,
            dests: dests,
            type: type,
            action: action,
            msgID: nanoid(MESSAGE_ID_LENGTH),
            created: Date.now(),
            userID: getStoreState().profile.userID,
            data: data,
            partnerIntPath: partnerIntPath,
        } as PoolMessage;
    }

    ////////////////////////////////////////////////////////////////
    // PoolMessage helpers functions
    ////////////////////////////////////////////////////////////////

    private getDistanceTo(lastSeenPath: number[]): number {
        let matches = 0;
        for (; matches < Math.min(this.nodePosition.Path.length, lastSeenPath.length); matches++) {
            if (this.nodePosition.Path[matches] != lastSeenPath[matches]) break;
        }
        return (this.nodePosition.Path.length - matches) + (lastSeenPath.length - matches);
    }
}

function initializeRTCPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]})
}

function initializeMainDataChannel(connection: RTCPeerConnection): RTCDataChannel {
    return connection.createDataChannel("main", {
        ordered: true,
        negotiated: true,
        id: 0,
    });
}