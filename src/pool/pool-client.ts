// import { SSNodeStatusData, SSReportCodes, SSReportNodeData, SSSDPData, SSStatus, SSMessage, SSAddNodesData, SSRemoveNodeData } from "./sync-server.model";
// import { PoolNodeState, Pool, PoolUpdateLatestInfo, PoolMessagePackage, PoolMessageType, PoolNode, PoolMessageAction, PoolUpdateNodeState, PoolFileRequest, PoolMessageSourceInfo, PoolMessageDestinationInfo, MESSAGE_ID_LENGTH, FILE_ID_LENGTH, PoolChunkRange, PoolImageOffer, PoolDownloadProgressStatus, PoolRequestMediaHint, PoolMessage, PoolRemoveFileRequest, PoolRetractFileOffer, PoolFileInfo, PoolFileOffer, PoolFileSeeders } from "./pool.model";
import { getStoreState, store } from "../store/store";
import { AddActiveNodeAction, AddDownloadAction, AddFileOfferAction, AddMessageAction, PoolAction, poolAction, RemoveActiveNodeAction, RemoveFileOfferAction, RemoveUserAction, ResetPoolAction, UpdateUserAction } from "../store/slices/pool.slice";
import { CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CHUNK_SIZE, DEFAULT_RECV_MESSAGES_CACHE, MAXIMUM_GET_LATEST_MESSAGE_LENGTH } from "../config/caching";
import { nanoid } from "nanoid";
// import { createBinaryMessage, parseBinaryMessage, setBinaryMessageDestVisited } from "./pool-binary-message";
import { FileManager, PoolManager } from "./global";
import { reportNodeDisconnect } from "./sync-server-client";
import { calcChunkRangesDifference, compactChunkRanges, existsInChunkRanges, getPartnerIntFromCacheChunkNumber, getCacheChunkNumberFromByteSize, getCacheChunkNumberFromChunkNumber, getChunkNumberFromCacheChunkNumber, inChunkRange, mapPromisedChunks, calcChunkRangesIntersection, addToChunkRanges } from "./pool-chunks";
import { CacheChunkData, PoolFile } from "./pool-file-manager";
import { mebibytesToBytes } from "../utils/file-size";
import EventEmitter from "events";
import { Image } from 'image-js';
import { checkFileExist } from "../utils/file-exists";
import { profileAction, ProfileState } from "../store/slices/profile.slice";
import { SSMessage_AddNodeData, SSMessage_InitPoolData, SSMessage_RemoveNodeData, SSMessage_RemoveUserData, SSMessage_UpdateUserData } from "./sync_server.v1";
import { PoolChunkInfo, PoolChunkRange, PoolFileInfo, PoolFileSeeders, PoolImageData, PoolMediaType, PoolMessage, PoolMessagePackage, PoolMessagePackageDestinationInfo, PoolMessagePackageSourceInfo, PoolMessagePackageWithChunk, PoolMessagePackageWithOnlyChunk, PoolFileOffer, PoolMessage_FileRequestData, PoolMessage_LatestReplyData, PoolMessage_LatestRequestData, PoolMessage_MediaHintReplyData, PoolMessage_MediaHintRequestData, PoolMessage_NodeStateData, PoolMessage_RetractFileRequestData, PoolMessage_Type, PoolNodeState } from "./pool.v1";
import { FILE_ID_LENGTH, MESSAGE_ID_LENGTH, Pool, PoolDownloadProgressStatus, PoolNode } from "./pool.model";
import { setMessagePackageDestVisited } from "./pool.v1.hacks";

const MAXIMUM_DC_BUFFER_SIZE = mebibytesToBytes(15);
const PREVIEW_IMAGE_DIMENSION = 10;
const MAX_FILE_REQUEST_RETRY = 3;
const DC_BUFFER_AVAILABLE_TO_FILL_NAME = "available-to-fill";
const LOW_BUFFER_THRESHOLD = MAXIMUM_DC_BUFFER_SIZE / CHUNK_SIZE;

// interface DataChannelBufferObject {
//     msgID: string;
//     data: Uint8Array;
//     emitSent: boolean;
//     inQueue?: string[]; // dest nodeID
// }

export interface PoolNodePosition {
    path: number[];
    partnerInt: number;
    centerCluster: boolean;
    parentClusterNodeIDs: string[][]; // 3, 3
    childClusterNodeIDs: string[][]; // 2, 3
}

interface PoolNodeConnection {
    position: number;
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    closeEvent: EventEmitter;
}

interface OngoingFileRequest {
    fileRequestData: PoolMessage_FileRequestData;
    startChunkNumber: number;
    wrappedAround: boolean;
    nextChunkNumber: number;
    chunksMissingRangeNumber: number;
    promisedChunksMap: Map<number, PoolChunkRange[]>; // key: cacheChunkNumber
    cancelled: boolean;
}

// interface PoolAvailableFile {
//     fileSeeders: PoolFileSeeders;
//     lastRequestedNodeID: string;
//     lastProgress: number;
//     retryCount: number;
// }

interface PoolMessageInfo {
    msgID: string;
    created: number;
}

interface PoolMessagePackageBundle {
    msgPkg: PoolMessagePackage;
    encodedMsgPkg: Uint8Array;
}

interface PoolCacheRequestInfo {
    requestingNodeID: string;
    requestedChunkRanges: PoolChunkRange[];
}

interface PoolCacheInfo {
    key: string; // only for browser, see CacheChunkData
    cacheChunkNumber: number;
}

enum MessageDirection {
    PARENT,
    CHILD,
    BOTH,
    NONE,
}

export class PoolClient {
    poolID: string;
    poolKey: number;
    ws: WebSocket;
    nodeID: string;
    nodePosition: PoolNodePosition;
    nodeConnections: Map<string, PoolNodeConnection>;
    reconnect: boolean;
    new: boolean;
    isOnlyNode: boolean;
    missedMessages: PoolMessage[];
    receivedMessages: PoolMessageInfo[];
    activeNodes: Map<string, number[]>; // key: nodeID, value: lastSeenPath
    availablefileSeeders: Map<string, PoolFileSeeders>; // key: fileID, value: availableFile
    curFileRequests: Map<string, OngoingFileRequest[]>; // key: fileID
    sendingCache: boolean;
    sendCacheRequestInfo: Map<string, PoolCacheRequestInfo[]>; // key: cacheChunkKey (In desktop, should be just fileID+cacheChunkNumber), value: CacheRequestInfos
    sendCacheQueue: PoolCacheInfo[]; // value: PoolCacheInfo
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
        this.nodePosition = {} as PoolNodePosition;
        this.nodeConnections = new Map<string, PoolNodeConnection>();
        this.reconnect = true;
        this.isOnlyNode = false;
        this.new = true;
        this.missedMessages = [];
        this.receivedMessages = [];
        this.activeNodes = new Map<string, number[]>();
        this.availablefileSeeders = new Map<string, PoolFileSeeders>();
        this.curFileRequests = new Map<string, OngoingFileRequest[]>();
        this.sendingCache = false;
        this.sendCacheRequestInfo = new Map<string, PoolCacheRequestInfo[]>();
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
        return this.nodePosition.path[this.nodePosition.path.length - 1]
    }

    disconnectFromPool() {
        this.reconnect = false;
        this.ws.close();
    }

    closeNodeConnection(nodeConnection: PoolNodeConnection) {
        nodeConnection.dataChannel.close();
        nodeConnection.connection.close();
        nodeConnection.closeEvent.emit('closed');
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
        this.availablefileSeeders.clear();
        this.curFileRequests.clear();

        if (!this.reconnect) {
            let dq = this.getPool().downloadQueue;
            for (let i = 0; i < dq.length; i++) {
                if (!dq[i].fileInfo) continue;
                FileManager.completeFileDownload(dq[i].fileInfo!.fileId);
            }
            store.dispatch(poolAction.clearPool({
                key: this.poolKey,
            } as PoolAction))
        }
    }

    updateIsOnlyNode() {
        this.isOnlyNode = false;
        if (this.nodePosition.centerCluster) {
            this.isOnlyNode = true
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (this.nodePosition.parentClusterNodeIDs[i][j] != "" && this.nodePosition.parentClusterNodeIDs[i][j] != this.nodeID) {
                        this.isOnlyNode = false;
                        break;
                    }
                }
                if (!this.isOnlyNode) break;
            }
            if (this.isOnlyNode) {
                this.new = false;
            }
        }
    }

    ////////////////////////////////////////////////////////////////
    // Node setup functions
    ////////////////////////////////////////////////////////////////

    updateNodePosition(nodePosition: PoolNodePosition) {
        // let isPromoting = this.nodePosition.path && this.nodePosition.path.length != nodePosition.path.length;
        this.nodePosition = nodePosition;
        console.log("Node position", this.nodePosition);
        this.checkForUneededBufferQueues();
        this.updateIsOnlyNode();
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
        
        let nodeConnection: PoolNodeConnection = {
            position: position,
            connection: connection,
            dataChannel: dataChannel,
            closeEvent: new EventEmitter(),
        };

        nodeConnection.closeEvent.once('closed', () => {
            reject();
        });

        this.nodeConnections.set(targetNodeID, nodeConnection);
    
        this.setDataChannelFunctions(nodeConnection, targetNodeID, true);
        
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            connection.onicegatheringstatechange = null;
            resolve(JSON.stringify(connection.localDescription));
        }
    
        connection.createOffer().then((d) => connection.setLocalDescription(d)).catch(() => reject());

        return promise;
    }

    answerOffer(targetNodeID: string, sdp: string): Promise<string> {
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

        let nodeConnection: PoolNodeConnection = {
            position: position,
            connection: connection,
            dataChannel: dataChannel,
            closeEvent: new EventEmitter(),
        };

        nodeConnection.closeEvent.once('closed', () => {
            reject();
        });
    
        this.nodeConnections.set(targetNodeID, nodeConnection);
    
        this.setDataChannelFunctions(nodeConnection, targetNodeID, false);
    
        connection.onicegatheringstatechange = () => {
            if (connection.iceGatheringState != 'complete') {
                return
            }
            connection.onicegatheringstatechange = null;
            resolve(JSON.stringify(connection.localDescription));
        }
    
        connection.setRemoteDescription(JSON.parse(sdp)).then(() => {
            connection.createAnswer().then((d) => connection.setLocalDescription(d)).catch(() => reject())
        }).catch(() => reject());

        return promise;
    }

    connectNode(targetNodeID: string, sdp: string): Promise<void> {
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

        nodeConnection.closeEvent.once('closed', () => {
            reject();
        });

        let connectionOpened = () => {
            if (nodeConnection) {
                nodeConnection.dataChannel.removeEventListener('open', connectionOpened);
                resolve();
            }
        };

        nodeConnection.dataChannel.addEventListener('open', connectionOpened);
        nodeConnection.connection.setRemoteDescription(JSON.parse(sdp)).catch(() => reject());

        return promise;
    }

    disconnectNode(targetNodeID: string) {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        if (nodeConnection){
            this.closeNodeConnection(nodeConnection);
            this.nodeConnections.delete(targetNodeID);
        }
    }

    verifyConnection(targetNodeID: string): boolean {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            return false;
        }
        return true;
    }

    initPool(initPoolData: SSMessage_InitPoolData) {
        if (!initPoolData.myNode) return;

        store.dispatch(poolAction.resetPool({
            key: this.poolKey,
        } as ResetPoolAction));

        // TEMP
        let myUser = initPoolData.updateUsers[0].userInfo!;
        store.dispatch(profileAction.initProfile({
            userID: myUser.userId,
            displayName: myUser.displayName,
            device: {
                deviceId: myUser.devices[0].deviceId,
                deviceType: myUser.devices[0].deviceType,
                deviceName: myUser.devices[0].deviceName,
            },
        } as ProfileState))
        // TEMP

        console.log("NodeID", initPoolData.myNode.nodeId);
        this.nodeID = initPoolData.myNode.nodeId;
        this.addNode(initPoolData.myNode);

        let fileOffersData: PoolFile[] = FileManager.getFileOffers(this.poolID) || [];
        for (const fileOfferData of fileOffersData) {
            this.addAvailableFileOffer({
                ...fileOfferData,
                seederNodeId: this.nodeID,
            });
        }

        for (const updateUser of initPoolData.updateUsers) {
            this.updateUser(updateUser);
        }

        for (const addNodeData of initPoolData.initNodes) {
            this.addNode(addNodeData, false);
        }
    }

    addNode(addNodeData: SSMessage_AddNodeData, addAsMessage: boolean = true) {
        let poolNode: PoolNode = {
            nodeID: addNodeData.nodeId,
            userID: addNodeData.userId,
            deviceID: addNodeData.deviceId,
            fileOffersInfo: [],
        };

        this.activeNodes.set(addNodeData.nodeId, addNodeData.path);
        store.dispatch(poolAction.addActiveNode({
            key: this.poolKey,
            node: poolNode,
        } as AddActiveNodeAction));

        if (addAsMessage) {
            let msg: PoolMessage = this.createNewMessage(
                PoolMessage_Type.NODE_STATE,
                this.createNodeStateMsgID(addNodeData.nodeId, addNodeData.timestamp, PoolNodeState.ACTIVE),
            );
            msg.nodeStateData = {
                nodeId: poolNode.nodeID,
                userId: poolNode.userID,
                state: PoolNodeState.ACTIVE,
            };
            msg.created = addNodeData.timestamp;
            this.addAndCheckMessage(msg);
        }
    }

    removeNode(removeNodeData: SSMessage_RemoveNodeData) {
        let nodeID: string = removeNodeData.nodeId;

        this.activeNodes.delete(nodeID);

        let existingNode: PoolNode | undefined = undefined;
        for (const node of this.getPool().activeNodes) {
            if (node.nodeID == nodeID) {
                existingNode = node;
                break;
            }
        }
        if (!existingNode) return;

        for (let i = 0; i < existingNode.fileOffersInfo.length; i++) {
            this.removeAvailableFileOffer(existingNode.fileOffersInfo[i].fileId, nodeID);
        }

        store.dispatch(poolAction.removeActiveNode({
            key: this.poolKey,
            nodeID: nodeID,
        } as RemoveActiveNodeAction));

        let msg: PoolMessage = this.createNewMessage(
            PoolMessage_Type.NODE_STATE, 
            this.createNodeStateMsgID(nodeID, removeNodeData.timestamp, PoolNodeState.INACTIVE),
        );
        msg.nodeStateData = {
            nodeId: nodeID,
            userId: existingNode.userID,
            state: PoolNodeState.INACTIVE,
        };
        msg.created = removeNodeData.timestamp;
        this.addAndCheckMessage(msg);
        
        for (const promotedNode of removeNodeData.promotedNodes) {
            this.activeNodes.set(promotedNode.nodeId, promotedNode.path);
        }
    }

    updateUser(updateUserData: SSMessage_UpdateUserData) {
        if (!updateUserData.userInfo) return;
        let updateUserAction: UpdateUserAction = {
            key: this.poolKey,
            userInfo: updateUserData.userInfo,
        };
        store.dispatch(poolAction.updateUser(updateUserAction));
    }

    removeUser(removeUserData: SSMessage_RemoveUserData) {
        store.dispatch(poolAction.removeUser({
            key: this.poolKey,
            userID: removeUserData.userId, 
        } as RemoveUserAction));
    }

    ////////////////////////////////////////////////////////////////
    // Send to pool functions
    ////////////////////////////////////////////////////////////////

    sendLatestRequest(nodeID: string) {
        let lastMessageID: string = "";
        let missedMessages: PoolMessage[] = [];
        if (!this.new) {
            console.log("Sending missed messages", this.missedMessages);
            missedMessages = this.missedMessages;
        }
        let initFileOffers: PoolFileOffer[] = [];
        if (this.new) {
            let files: PoolFile[] = FileManager.getFileOffers(this.poolID) || [];
            for (const file of files) {
                initFileOffers.push({
                    fileInfo: file.fileInfo,
                    seederNodeId: this.nodeID,
                });
            }
        }

        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.LATEST_REQUEST);
        msg.latestRequestData = {
            messagesOnly: this.new ? false : true,
            lastMessageId: lastMessageID,
            missedMessages: missedMessages,
            initFileOffers: initFileOffers,
        }

        this.sendDataChannel(nodeID, this.createMessagePackageBundle(msg, nodeID));
    }

    sendLatestReply(fromNodeID: string, latestRequest: PoolMessage_LatestRequestData) {
        let pool = this.getPool();
        let messagesOnly = latestRequest.messagesOnly;
        let lastMessageID = latestRequest.lastMessageId;

        if (lastMessageID != "" && latestRequest.missedMessages.length != 0) {
            console.log("Received missed messages:", latestRequest.missedMessages);
            for (const message of latestRequest.missedMessages) {
                // The reason for this is due to how missed messages work
                // Missed messages only send to one of the neighbouring nodes
                // Regardless, if they are missed, it is posible that everyone missed it
                this.handleMessage(this.createMessagePackageBundle(message));
            }
            // this.addMessages(latestRequest.missedMessages);
        }

        for (const fileOffer of latestRequest.initFileOffers) {
            this.addAvailableFileOffer(fileOffer);
        }

        let messages: PoolMessage[] = [];
        let lastMessageIdFound: boolean = true;
        let fileSeeders: PoolFileSeeders[] = [];

        if (!messagesOnly) {
            this.availablefileSeeders.forEach((seeders) => {
                fileSeeders.push(seeders);
            });
        }
        
        if (lastMessageID == "") {
            messages = pool.messages.slice(-MAXIMUM_GET_LATEST_MESSAGE_LENGTH);
        } else {
            let i = pool.messages.length - 1;
            for (; i >= 0; i--) {
                if (pool.messages[i].msgId == lastMessageID) {
                    break;
                }
            }
            if (i == -1) {
                lastMessageIdFound = false;
                messages = pool.messages;
            } else {
                messages = pool.messages.slice(i + 1);
            }
        }

        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.LATEST_REPLY);
        msg.latestReplyData = {
            messages,
            fileSeeders,
            lastMessageIdFound,
        }
        this.sendDataChannel(fromNodeID, this.createMessagePackageBundle(msg, fromNodeID));
    }

    sendTextMessage(text: string) {
        text = text.trim()
        if (text == "" || text.length >= this.getPool().poolSettings.maxTextLength || text.replaceAll(" ", "").replaceAll("&nbsp;", "").replaceAll("<br>", "") == "") {
            return;
        }
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.TEXT);
        msg.textData = {
            text,
        }
        this.handleMessage(this.createMessagePackageBundle(msg));
    }

    sendFileOffer(file: File, fileID: string = nanoid(FILE_ID_LENGTH), originNodeID: string = this.nodeID) {
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.FILE_OFFER);
        msg.fileOfferData = {
            fileInfo: {
                fileId: fileID,
                fileName: file.name,
                totalSize: file.size,
                originNodeId: originNodeID,
            },
            seederNodeId: this.nodeID,
        }
        if (!FileManager.addFileOffer(this.poolID, msg.fileOfferData.fileInfo!, file)) return;
        this.handleMessage(this.createMessagePackageBundle(msg));
    }
    
    async sendImageOffer(file: File) {
        if (file.size > this.getPool().poolSettings.maxMediaSize) {
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
        let previewImageBase64 = "data:image/" + format + ";base64," + await image.toBase64();
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.MEDIA_OFFER);
        msg.mediaOfferData = {
            fileOffer: {
                fileInfo: {
                    fileId: fileID,
                    fileName: file.name,
                    totalSize: file.size,
                    originNodeId: this.nodeID,
                },
                seederNodeId: this.nodeID,
            },
            mediaType: PoolMediaType.IMAGE,
            format,
            imageData: {
                width,
                height,
                previewImageBase64,
            }
        }
        if (!FileManager.addFileOffer(this.poolID, msg.mediaOfferData!.fileOffer!.fileInfo!, file)) return;
        FileManager.addMediaCache(fileID, file);
        this.handleMessage(this.createMessagePackageBundle(msg));
        this.sendMedia(fileID);
    }

    async sendFileRequest(fileInfo: PoolFileInfo, isMedia: boolean, chunksMissing?: PoolChunkRange[], hinterNodeID?: string) {
        let fileID = fileInfo.fileId;

        if (FileManager.hasFileOffer(this.poolID, fileID)) {
            let exists = await this.validateFileOffer(fileID);
            if (exists) return;
        }

        //console.log(FileManager.hasFileDownload(fileID), chunksMissing, hinterNodeID);
        if (!FileManager.hasFileDownload(fileID)) {
            if (!(await FileManager.addFileDownload(this.poolID, this.poolKey, fileInfo, isMedia))) return;
        } else if (!chunksMissing && !hinterNodeID) return;


        let fileDownload = FileManager.getFileDownload(fileID)!;
        let fileSeeders = this.availablefileSeeders.get(fileID);
        
        //console.log(availableFile, fileID);
        let requestNodeID = "";
        if (fileSeeders) {

            let seederNodeIDs = fileSeeders.seederNodeIds;
            seederNodeIDs.sort((a, b) => {
                let lspA = this.activeNodes.get(a);
                let lspB = this.activeNodes.get(b);
                if (!lspA || !lspB) return 0; // shouldn't be logically possible
                return this.getDistanceTo(lspA) - this.getDistanceTo(lspB);
            });

            if (fileDownload.lastRequestedNodeID != "") {
                if (fileDownload.retryCount > MAX_FILE_REQUEST_RETRY) {
                    let index = seederNodeIDs.indexOf(fileDownload.lastRequestedNodeID);
                    index++;
                    if (index >= seederNodeIDs.length) {
                        index = 0;
                    }
                    requestNodeID = seederNodeIDs[index];
                    fileDownload.retryCount = 0;
                } else {
                    requestNodeID = fileDownload.lastRequestedNodeID;
                }
            } else {
                requestNodeID = seederNodeIDs[0];
            }

            let progress = FileManager.getFileDownloadProgress(fileID);
            if (fileDownload.lastRequestedNodeID == requestNodeID && fileDownload.lastProgress == progress) {
                fileDownload.retryCount++;
            } else {
                fileDownload.retryCount = 0;
            }

            fileDownload.lastRequestedNodeID = requestNodeID;
            fileDownload.lastProgress = progress;

        }

        if (isMedia && requestNodeID == "") {

            let hinterNodeIDs = fileDownload.hinterNodeIDs;
            //console.log(nodeIDs);
            if (!hinterNodeID && hinterNodeIDs) {
                if (hinterNodeIDs.length == 0 || hinterNodeIDs.length == 1) { // No response from hints, should remove from queue to prevent sending automatic hints again 
                    // this.mediaHinterNodeIDs.delete(fileID);
                    FileManager.completeFileDownload(fileID);
                    return;
                }
                hinterNodeIDs.splice(0, 1);
            }

            if (!hinterNodeIDs) {
                hinterNodeIDs = [];
                fileDownload.hinterNodeIDs = hinterNodeIDs;
            }

            if (hinterNodeID) {
                hinterNodeIDs.push(hinterNodeID);
                if (hinterNodeIDs.length != 1) return;
            }

            if (hinterNodeIDs.length > 0) {
                requestNodeID = hinterNodeIDs[0];
            }

        }

        if (requestNodeID != "") {

            fileDownload.status = chunksMissing ? PoolDownloadProgressStatus.RETRYING : PoolDownloadProgressStatus.DOWNLOADING;
            store.dispatch(poolAction.updateDownloadSeederNodeID({
                key: this.poolKey,
                fileID: fileID,
                seederNodeID: requestNodeID,
            }));

            let fileRequest: PoolMessage_FileRequestData = {
                fileId: fileID,
                requestingNodeId: this.nodeID,
                chunksMissing: chunksMissing || [],
                promisedChunks: [],
            };

            if (FileManager.hasMediaCache(fileID)) {
                this.sendFile(fileRequest);
            } else {
                for (let i = 0; i < 3; i++) {
                    let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.FILE_REQUEST);
                    msg.fileRequestData = fileRequest;
                    fileRequest.promisedChunks = [];
                    this.handleMessage(this.createMessagePackageBundle(msg, requestNodeID, i));
                }
            }

        } else {
            
            fileDownload.status = PoolDownloadProgressStatus.UNAVAILABLE;
            store.dispatch(poolAction.updateDownloadSeederNodeID({
                key: this.poolKey,
                fileID: fileID,
                seederNodeID: "",
            }));

            if (isMedia) {
                this.sendMediaHintRequest(fileInfo);
            }

        }
    }

    sendMediaHintRequest(fileInfo: PoolFileInfo) {
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.MEDIA_HINT_REQUEST);
        msg.mediaHintRequestData = {
            fileId: fileInfo.fileId,
        }
        this.handleMessage(this.createMessagePackageBundle(msg));
    }

    sendMediaHintReply(originNodeID: string, mediaHintRequest: PoolMessage_MediaHintRequestData) {
        if (!FileManager.hasMediaCache(mediaHintRequest.fileId)) return;
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.MEDIA_HINT_REPLY);
        msg.mediaHintReplyData = {
            fileId: mediaHintRequest.fileId,
        }
        this.handleMessage(this.createMessagePackageBundle(msg, originNodeID));
    }

    sendMediaRequestFromHintReply(hinterNodeID: string, mediaHintReply: PoolMessage_MediaHintReplyData) {
        let fileInfo = FileManager.getFileDownloadInfo(mediaHintReply.fileId);
        if (!fileInfo) return;
        this.sendFileRequest(fileInfo, true, undefined, hinterNodeID);
    }

    sendRetractFileOffer(fileID: string) {
        if (!FileManager.hasFileOffer(this.poolID, fileID)) return;
        FileManager.removeFileOffer(this.poolID, fileID);
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.RETRACT_FILE_OFFER);
        msg.retractFileOfferData = {
            fileId: fileID,
            nodeId: this.nodeID,
        };
        this.handleMessage(this.createMessagePackageBundle(msg));
    }

    sendRetractFileRequest(fileOffer: PoolFileOffer) {
        let fileID = fileOffer.fileInfo?.fileId;
        if (!fileID) return;
        if (!FileManager.hasFileDownload(fileID)) return;
        FileManager.completeFileDownload(fileID);
        if (fileOffer.seederNodeId == "") return;
        let msg: PoolMessage = this.createNewMessage(PoolMessage_Type.RETRACT_FILE_REQUEST);
        msg.retractFileRequestData = {
            fileId: fileID,
            requestingNodeId: this.nodeID,
        };
        this.handleMessage(this.createMessagePackageBundle(msg, fileOffer.seederNodeId));
    }

    ////////////////////////////////////////////////////////////////
    // Send chunk functions
    ////////////////////////////////////////////////////////////////

    sendChunk(fileID: string, chunkNumber: number, chunk: Uint8Array, destNodeIDs: string[] | undefined): Promise<boolean> {

        if (!this.reconnect) return Promise.resolve(false);
        let hasMyNode = false;
        if (destNodeIDs) {
            for (let i = destNodeIDs.length - 1; i >= 0; i--) {
                // dests[i].visited = false;
                if (destNodeIDs[i] == this.nodeID) {
                    // console.log("ADDING FILE CHUNK", chunkNumber);
                    // No splice because other than !this.activeNodes.has(destNodeID), dests are not supposed to change
                    // getDests() will make our node visited regardless 
                    FileManager.addFileChunk(fileID, chunkNumber, chunk);
                    hasMyNode = true;
                } else if (!this.activeNodes.has(destNodeIDs[i])) {
                    console.log("ACTIVE NODE NO LONGER ACTIVE", this.activeNodes);
                    destNodeIDs.splice(i, 1);
                }
            }
            if (destNodeIDs.length == 0 || (destNodeIDs.length == 1 && hasMyNode)) {
                // if (nextChunk) nextChunk();
                // return;
                return Promise.resolve(true);
            }
        }

        // console.log("sending chunk", chunkNumber, destNodeIDs);
        // console.log(chunk);

        let chunkInfo: PoolChunkInfo = {
            fileId: fileID,
            chunkNumber,
        };
        this.broadcastMessage(this.createChunkMessagePackageBundle(chunkInfo, new Uint8Array(chunk), destNodeIDs));
        
        if (!this.checkBufferQueueFree()) {
            let resolve: (value: boolean | PromiseLike<boolean>) => void;
            let promise = new Promise<boolean>((res, rej) => {
                resolve = res;
            });
            // console.log("CHUNK IS WAITING");
            this.DCBufferQueueEventEmitter.once(DC_BUFFER_AVAILABLE_TO_FILL_NAME, () => {
                //console.log("FINALLY SENDING CHUNK", chunkNumber);
                // if (nextChunk) nextChunk();
                resolve(true);
            })
            return promise;
        } else {
            // if (nextChunk) nextChunk();
            return Promise.resolve(true);
        }
    }

    async sendFile(fileRequestData: PoolMessage_FileRequestData) {
        let fileSource: File | Blob;
        let fileID: string = fileRequestData.fileId;

        if (FileManager.hasFileOffer(this.poolID, fileID)) {
            let exists = await this.validateFileOffer(fileID);
            if (!exists && !FileManager.hasMediaCache(fileID)) return;
        } else if (!FileManager.hasMediaCache(fileID)) return;

        // The reason why this partitioning works if because the chunkRanges are most likely
        // going to be one per cacheChunk, if not, it doesn't matter becasue we garaunteed
        // it to be within a cacheChunk anyways as part of the specification
        let promisedChunksMap: Map<number, PoolChunkRange[]> = mapPromisedChunks(fileRequestData.promisedChunks);

        let fileRequest: OngoingFileRequest = {
            fileRequestData: fileRequestData,
            startChunkNumber: -1,
            nextChunkNumber: 0,
            wrappedAround: false,
            chunksMissingRangeNumber: 0,
            promisedChunksMap: promisedChunksMap,
            cancelled: false,
        };

        let concFileRequests = this.curFileRequests.get(fileID);
        if (!concFileRequests) {
            concFileRequests = [fileRequest];
            this.curFileRequests.set(fileID, concFileRequests);

            if (FileManager.hasFileOffer(this.poolID, fileID)) {
                fileSource = FileManager.getFileOffer(this.poolID, fileID)!.file;
                if (fileRequestData.requestingNodeId != this.nodeID && !this.activeNodes.has(fileRequestData.requestingNodeId)) return;    
            } else if (FileManager.hasMediaCache(fileID)) {
                let mediaObjectURL = FileManager.getMediaCache(fileID)!;
                fileSource = await (await fetch(mediaObjectURL)).blob();
            }
        } else {
            for (let i = 0; i < concFileRequests.length; i++) {
                if (concFileRequests[i].fileRequestData.requestingNodeId == fileRequest.fileRequestData.requestingNodeId) {

                    let requestingFileRequest = concFileRequests[i];
                    if (requestingFileRequest.fileRequestData.chunksMissing.length != 0) return;

                    promisedChunksMap.forEach((chunkRanges, cacheChunkNumber) => {
                        let existingChunkRanges = requestingFileRequest.promisedChunksMap.get(cacheChunkNumber);
                        if (!existingChunkRanges) {
                            existingChunkRanges = [];
                            requestingFileRequest.promisedChunksMap.set(cacheChunkNumber, existingChunkRanges);
                        }
                        for (const chunkRange of chunkRanges) {
                            addToChunkRanges(chunkRange, existingChunkRanges);
                        }
                    });
                    return;
                }
            }
            concFileRequests.push(fileRequest);
            return;
        }

        // chunksMissing are only considered if there are no existing requests
        // This is to counter network congestion issues 
        if (fileRequestData.chunksMissing.length != 0) {
            compactChunkRanges(fileRequestData.chunksMissing);
        }

        let chunkNumber = 0;
        let totalChunks = Math.ceil(fileSource!.size / CHUNK_SIZE);
        let destNodeIDs: string[]; // UPDATE DEST EERY TIME NEXT CHUNK IS DONE, SO fileReader.onload doesn't need to check again

        let fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            if (e.target?.error != null) {
                this.sendRetractFileOffer(fileID);
            }
            if (!e.target) return;
            if (!FileManager.hasFileOffer(this.poolID, fileID) && !FileManager.hasMediaCache(fileID)) return;
            this.sendChunk(fileID, chunkNumber++, new Uint8Array(e.target.result as ArrayBuffer), destNodeIDs).then((success) => {
                if (success) {
                    nextChunk();
                }
            });
        }

        // Having nextChunk is ok for now since fileReader is async
        // But if fileReader isn't async, chaining nextChunk will lead to stack overflow
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
                let reqData = req.fileRequestData;
                if (req.cancelled || !this.activeNodes.has(reqData.requestingNodeId)) {
                    concFileRequests.splice(i, 1);
                    continue;
                }
                if (req.startChunkNumber == -1) {
                    req.startChunkNumber = chunkNumber;
                    req.nextChunkNumber = chunkNumber;
                }
                if (req.nextChunkNumber > chunkNumber) {
                    if (req.nextChunkNumber < minNextChunkNumber) {
                        destNodeIDs = [reqData.requestingNodeId];
                        minNextChunkNumber = req.nextChunkNumber;
                    } else if (req.nextChunkNumber == minNextChunkNumber) {
                        destNodeIDs.push(reqData.requestingNodeId);
                    }
                    continue;
                } else {
                    req.nextChunkNumber = chunkNumber;
                }
                if (reqData.chunksMissing.length != 0) {
                    // do {
                    if (req.nextChunkNumber >= totalChunks) break;
                    if (req.nextChunkNumber < reqData.chunksMissing[req.chunksMissingRangeNumber].start) {
                        req.nextChunkNumber = reqData.chunksMissing[req.chunksMissingRangeNumber].start;
                    } else if (req.nextChunkNumber > reqData.chunksMissing[req.chunksMissingRangeNumber].end) {
                        do {
                            req.chunksMissingRangeNumber++;
                            if (req.chunksMissingRangeNumber >= reqData.chunksMissing.length) {
                                req.nextChunkNumber = totalChunks;
                                break;
                            }
                            if (req.nextChunkNumber <= reqData.chunksMissing[req.chunksMissingRangeNumber].end) {
                                if (reqData.chunksMissing[req.chunksMissingRangeNumber].start > req.nextChunkNumber) {
                                    req.nextChunkNumber = reqData.chunksMissing[req.chunksMissingRangeNumber].start;
                                }
                                break;
                            }
                        } while (true);
                    }
                    //     let chunkRanges = req.promisedChunksMap.get(getCacheChunkNumberFromChunkNumber(req.nextChunkNumber));
                    //     if (chunkRanges) {
                    //         let chunkRange = existsInChunkRanges(req.nextChunkNumber, chunkRanges);
                    //         if (chunkRange) {
                    //             req.nextChunkNumber = chunkRange.end + 1;
                    //             continue;
                    //         }
                    //     }
                    //     break;
                    // } while (true);
                } else {
                    while (req.nextChunkNumber < totalChunks) {
                        let chunkRanges = req.promisedChunksMap.get(getCacheChunkNumberFromChunkNumber(req.nextChunkNumber));
                        if (chunkRanges) {
                            let chunkRange = existsInChunkRanges(req.nextChunkNumber, chunkRanges);
                            if (chunkRange) {
                                req.nextChunkNumber = chunkRange.end + 1;
                                continue;
                            }
                        }
                        break;
                    }
                }
                if (req.wrappedAround && req.nextChunkNumber >= req.startChunkNumber) {
                    //console.log(req);
                    concFileRequests.splice(i, 1);
                    continue;
                }
                if (req.nextChunkNumber < minNextChunkNumber) {
                    destNodeIDs = [reqData.requestingNodeId];
                    minNextChunkNumber = req.nextChunkNumber;
                } else if (req.nextChunkNumber == minNextChunkNumber) {
                    destNodeIDs.push(reqData.requestingNodeId);
                }
            }

            if (concFileRequests.length == 0) {
                this.curFileRequests.delete(fileID);
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
        let fileOfferData: PoolFile | undefined = FileManager.getFileOffer(this.poolID, fileID);
        if (!fileOfferData) return;

        let chunkNumber = 0;
        let totalChunks = Math.ceil(fileOfferData.file.size / CHUNK_SIZE);

        let fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            if (e.target?.error != null) {
                this.sendRetractFileOffer(fileID);
            }
            if (!e.target) return;
            if (!FileManager.hasFileOffer(this.poolID, fileID) && !FileManager.hasMediaCache(fileID)) return;
            this.sendChunk(fileID, chunkNumber++, new Uint8Array(e.target.result as ArrayBuffer), undefined).then((success) => {
                if (success) {
                    nextChunk();
                }
            });;
        }

        let nextChunk = () => {
            if (chunkNumber >= totalChunks) return;
            let offset = chunkNumber * CHUNK_SIZE;

            fileReader.readAsArrayBuffer(fileOfferData!.file.slice(offset, offset + CHUNK_SIZE));
        } 

        console.log("SENDING MEDIA");
        nextChunk();
    }

    // In desktop, params should just be fileID, cacheChunkNumber, requestedChunkRanges, and requestingNodeID
    // The idea is cacheChunkNumber should be put into queue, not the actual chunkRange so when actually sending,
    // just need to seek, then read the whole cacheChunk (one call) and send only the parts that are requested
    addPromisedChunks(key: string, cacheChunkNumber: number, requestedChunkRanges: PoolChunkRange[], requestingNodeID: string) {
        let existingSendCache = this.sendCacheRequestInfo.get(key);
        if (!existingSendCache) {
            existingSendCache = [];
            this.sendCacheRequestInfo.set(key, existingSendCache);
            this.sendCacheQueue.push({
                key,
                cacheChunkNumber,
            });
        }
        let foundCacheRequest: boolean = false;
        for (const cacheReqInfo of existingSendCache) {
            if (cacheReqInfo.requestingNodeID == requestingNodeID) {
                cacheReqInfo.requestedChunkRanges.push(...requestedChunkRanges);
                // compactChunkRanges(cacheReqInfo.requestedChunkRanges); // Not needed as it is only used as check
                foundCacheRequest = true;
                break;
            }
        }
        if (!foundCacheRequest) {
            existingSendCache.push({
                requestingNodeID,
                requestedChunkRanges,
            });
        }
        if (!this.sendingCache) this.startSendPromisedChunks();
    }

    async startSendPromisedChunks() {
        this.sendingCache = true;
        console.log("START SEND CACHE");
        // nextCacheChunk();

        while (this.sendCacheQueue.length != 0 && this.reconnect) {
            let cacheInfo = this.sendCacheQueue[0];
            let cacheChunk = await FileManager.getCacheChunk(cacheInfo.key);
            this.sendCacheQueue.shift();
            let cacheRequests = this.sendCacheRequestInfo.get(cacheInfo.key);
            this.sendCacheRequestInfo.delete(cacheInfo.key);
            if (!cacheChunk) {
                // POSSIBLE TO SEND REQUEST FOR THESE CHUNKS ON BEHALF?
                console.log("NO CACHECHUNK", cacheInfo.key);
                continue;
            }
            if (cacheRequests) {
                for (let i = cacheRequests.length - 1; i >= 0; i--) {
                    if (!this.activeNodes.has(cacheRequests[i].requestingNodeID)) {
                        cacheRequests.splice(i, 1);
                    }
                }
            }
            if (!cacheRequests || cacheRequests.length == 0) {
                continue;
            }

            let fileID = cacheInfo.key.split(':')[2];
            let chunkNumber = getChunkNumberFromCacheChunkNumber(cacheInfo.cacheChunkNumber);
            let success = true;
            // console.log("SENDING CACHECHUNK NUMBER", cacheChunkData.cacheChunkNumber);
            for (let i = 0; i < cacheChunk.length; i++, chunkNumber++) {        
                // In browser, we don't need to check because cacheChunks are complete
                // if (cacheChunk[i] DNE) continue;

                let destNodeIDs = [];
                for (const cacheRequest of cacheRequests) {
                    for (const chunkRange of cacheRequest.requestedChunkRanges) { 
                        if (inChunkRange(chunkNumber, chunkRange)) {
                            destNodeIDs.push(cacheRequest.requestingNodeID);
                            break;
                        }
                    }
                }

                // console.log("Sending cache to", destNodeIDs, chunkNumber);

                success = await this.sendChunk(fileID, chunkNumber, cacheChunk[i], destNodeIDs);
            }

            if (!success) break;
        }
        console.log("END SEND CACHE");
        this.sendingCache = false;
    }

    sendPromisedChunks(fileRequestData: PoolMessage_FileRequestData, partnerIntPath: number): boolean {
        let updatedData = false;
        let fileID = fileRequestData.fileId;

        if (fileRequestData.chunksMissing.length != 0) return updatedData; 

        if (!this.availablefileSeeders.has(fileID)) return updatedData;
        if (partnerIntPath != this.nodePosition.partnerInt && fileRequestData.requestingNodeId != this.nodeID) return updatedData;

        // partnerIntPath == this.nodePosition.partnerInt

        let alreadyPromisedChunksMap: Map<number, PoolChunkRange[]> = mapPromisedChunks(fileRequestData.promisedChunks);
        if (FileManager.hasMediaCache(fileID)) {

            let totalSize = this.availablefileSeeders.get(fileID)?.fileInfo?.totalSize;
            if (!totalSize) return updatedData;

            // console.log(getCacheChunkNumberFromByteSize(totalSize));
            for (let cacheChunkNumber = 0; cacheChunkNumber <= getCacheChunkNumberFromByteSize(totalSize); cacheChunkNumber++) {
                if (getPartnerIntFromCacheChunkNumber(cacheChunkNumber) == partnerIntPath && !alreadyPromisedChunksMap.has(cacheChunkNumber)) {
                    fileRequestData.promisedChunks.push({
                        start: getChunkNumberFromCacheChunkNumber(cacheChunkNumber),
                        end: getChunkNumberFromCacheChunkNumber(cacheChunkNumber + 1) - 1,
                    });
                    updatedData = true;
                }
            }

            // console.log(fileRequestData.promisedCacheChunks, partnerIntPath);
            this.sendFile(fileRequestData);

        } else {

            let cacheChunkMapData = FileManager.getCacheChunkMapData(fileID);
            if (!cacheChunkMapData) return updatedData;

            // if (fileRequestData.chunksMissing.length == 0) {
                cacheChunkMapData.forEach((cacheChunkData, cacheChunkNumber) => {
                    if (getPartnerIntFromCacheChunkNumber(cacheChunkNumber) == partnerIntPath) {
                        let alreadyPromisedChunks = alreadyPromisedChunksMap.get(cacheChunkNumber) || [];
                        let promisedChunks = calcChunkRangesDifference(cacheChunkData.chunkRanges, alreadyPromisedChunks, true);
                        if (promisedChunks.length == 0) return;
                        this.addPromisedChunks(
                            cacheChunkData.key,
                            cacheChunkNumber,
                            promisedChunks,
                            fileRequestData.requestingNodeId,
                        );
                        for (const chunkRange of promisedChunks) {
                            // promisedChunks doesn't need to be sorted or compacted
                            fileRequestData.promisedChunks.push(chunkRange);
                            // addToChunkRanges(chunkRange, fileRequestData.promisedChunks);
                        }
                        updatedData = true;
                    }
                });
            // }
            // chunks missing shouldn't have promisedCacheChunks
            // it's bad for network congestion, and node should have
            // at least one way to deal with "accidently" non compliant
            // nodes (i.e node malfunctions and adds to promisedChunks even)
            // when they don't have the chunks

            // else {
            //     compactChunkRanges(fileRequestData.chunksMissing);
            //     for (let i = 0; i < fileRequestData.chunksMissing.length; i++) {
            //         let startCacheChunkNumber = getCacheChunkNumberFromChunkNumber(fileRequestData.chunksMissing[i].start);
            //         let endCacheChunkNumber = getCacheChunkNumberFromChunkNumber(fileRequestData.chunksMissing[i].end);
            //         for (let cacheChunkNumber = startCacheChunkNumber; cacheChunkNumber <= endCacheChunkNumber; cacheChunkNumber++) {
            //             if (getPartnerIntFromCacheChunkNumber(cacheChunkNumber) == partnerIntPath) {
            //                 let cacheChunkData = cacheChunkMapData.get(cacheChunkNumber);
            //                 if (!cacheChunkData) continue;
            //                 let alreadyPromisedChunks = alreadyPromisedChunksMap.get(cacheChunkNumber) || [];
            //                 let promisedChunks = calcChunkRangesDifference(cacheChunkData.chunkRanges, alreadyPromisedChunks, true);
            //                 if (promisedChunks.length == 0) continue;
            //                 let relevantPromisedChunks = calcChunkRangesIntersection(promisedChunks, [fileRequestData.chunksMissing[i]], true);
            //                 if (relevantPromisedChunks.length == 0) continue;
            //                 this.addPromisedChunks(
            //                     cacheChunkData.key,
            //                     cacheChunkNumber,
            //                     relevantPromisedChunks,
            //                     fileRequestData.requestingNodeId,
            //                 );
            //                 for (const chunkRange of relevantPromisedChunks) {
            //                     // promisedChunks doesn't need to be sorted or compacted
            //                     fileRequestData.promisedChunks.push(chunkRange);
            //                     // addToChunkRanges(chunkRange, fileRequestData.promisedChunks);
            //                 }
            //                 updatedData = true;
            //             }
            //         }
            //     }
            // }
        }

        return updatedData;
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage helper functions
    ////////////////////////////////////////////////////////////////

    addAvailableFileOffer(fileOffer: PoolFileOffer) {
        let fileInfo = fileOffer.fileInfo;
        if (!fileInfo) return;
        let fileID = fileInfo.fileId;
        let fileSeeders = this.availablefileSeeders.get(fileID);
        console.log("ADDING AVAILABLE FILE", fileID);
        if (!fileSeeders) {
            fileSeeders = {
                fileInfo,
                seederNodeIds: [],
            };
            this.availablefileSeeders.set(fileID, fileSeeders);
            //console.log("SETTING AVAILABLE FILE", this.availableFiles.size);
        }
        //console.log(availableFile.fileOfferAndSeeders.seederNodeIDs.length, availableFile.fileOfferAndSeeders.seederNodeIDs.includes(fileOffer.seederNodeID), fileOffer.seederNodeID)
        if (!fileSeeders.seederNodeIds.includes(fileOffer.seederNodeId)) {
            fileSeeders.seederNodeIds.push(fileOffer.seederNodeId);
            store.dispatch(poolAction.addFileOffer({
                key: this.poolKey,
                fileOffer: fileOffer,
            } as AddFileOfferAction));
            //console.log(this.getPool().Users, this.getPool().myNode);
        }
    }

    removeAvailableFileOffer(fileID: string, nodeID: string) {
        let fileSeeders = this.availablefileSeeders.get(fileID);
        if (!fileSeeders) return;
        let seederNodeIDs = fileSeeders.seederNodeIds;
        for (let i = 0; i < seederNodeIDs.length; i++) {
            if (seederNodeIDs[i] == nodeID) {
                seederNodeIDs.splice(i, 1);
                store.dispatch(poolAction.removeFileOffer({
                    key: this.poolKey,
                    fileID: fileID,
                    nodeID: nodeID,
                } as RemoveFileOfferAction));
                break;
            }
        }
        if (seederNodeIDs.length == 0) this.availablefileSeeders.delete(fileID);
    }

    validateFileOffer(fileID: string): Promise<boolean> {
        let fileOffer = FileManager.getFileOffer(this.poolID, fileID);
        if (!fileOffer) {
            return Promise.resolve(false);
        }
        return checkFileExist(fileOffer.file).then((exists) => {
            if (!exists) {
                console.log("FILE DOESN'T EXIST, REMOVING FILE OFFER");
                this.sendRetractFileOffer(fileID);
            }
            return exists;
        });
    }

    updateLatest(latestReplyData: PoolMessage_LatestReplyData) {
        this.addMessages(latestReplyData.messages);
        if (this.new) { // !messagesOnly
            store.dispatch(poolAction.clearFileOffers({ key: this.poolKey } as PoolAction));
            this.availablefileSeeders.clear();
            for (const fileSeeders of latestReplyData.fileSeeders) {
                for (const seederNodeID of fileSeeders.seederNodeIds) {
                    let fileOffer: PoolFileOffer = {
                        ...fileSeeders,
                        seederNodeId: seederNodeID,
                    }
                    this.addAvailableFileOffer(fileOffer);
                }
            }
        }
        this.new = false;
    }

    retractFileRequest(retractFileRequestData: PoolMessage_RetractFileRequestData) {
        let fileRequests = this.curFileRequests.get(retractFileRequestData.fileId);
        if (!fileRequests) return;
        for (let i = 0; i < fileRequests.length; i++) {
            if (fileRequests[i].fileRequestData.requestingNodeId == retractFileRequestData.requestingNodeId) {
                fileRequests.splice(i, 1);
                break;
            }
        }
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage functions
    ////////////////////////////////////////////////////////////////

    handleMessage(msgPkgBundle: PoolMessagePackageBundle, fromNodeID: string = this.nodeID) {
        let msgPkg = msgPkgBundle.msgPkg;
        let src = msgPkg.src;
        let dests = msgPkg.dests;
        let hasDests = dests.length != 0;
        let partnerIntPath = msgPkg.partnerIntPath;
        let hasPartnerIntPath = partnerIntPath != undefined;
        let msg = msgPkg.msg;

        if (!msg || !src) return;

        if (this.checkMessageDuplicate(msg)) return;

        console.log("MSG RECV:", JSON.stringify(msgPkg));

        if (hasDests) {
            let isADest: boolean = this.checkAtMyDest(dests);
            if (isADest) {
                switch (msg.type) {
                    case PoolMessage_Type.LATEST_REQUEST:
                        if (!msg.latestRequestData) return;
                        this.sendLatestReply(src.nodeId, msg.latestRequestData);
                        break;
                    case PoolMessage_Type.LATEST_REPLY:
                        if (!msg.latestReplyData) return;
                        this.updateLatest(msg.latestReplyData);
                        break;
                    case PoolMessage_Type.FILE_REQUEST:
                        if (!msg.fileRequestData) return;
                        this.sendFile(msg.fileRequestData);
                        break;
                    case PoolMessage_Type.RETRACT_FILE_REQUEST:
                        if (!msg.retractFileRequestData) return;
                        this.retractFileRequest(msg.retractFileRequestData);
                        break;
                    case PoolMessage_Type.MEDIA_HINT_REPLY:
                        if (!msg.mediaHintReplyData) return;
                        this.sendMediaRequestFromHintReply(src.nodeId, msg.mediaHintReplyData);
                        break;
                    default:
                        return;
                }
                if (dests.length == 1) return;
            } else {
                switch (msg.type) {
                    case PoolMessage_Type.FILE_REQUEST:
                        if (!msg.fileRequestData) return;
                        if (hasPartnerIntPath) {
                            if (this.sendPromisedChunks(msg.fileRequestData, partnerIntPath!)) {
                                msgPkgBundle.encodedMsgPkg = PoolMessagePackage.encode(msgPkg).finish();
                            }
                        }
                        break;
                }
            }
            
        } else {
            switch (msg.type) {
                case PoolMessage_Type.TEXT:
                    if (!msg.textData) return;
                    this.addMessage(msg);
                    break;
                case PoolMessage_Type.FILE_OFFER:
                    if (!msg.fileOfferData?.fileInfo) return;    
                    this.addAvailableFileOffer(msg.fileOfferData);
                    if (msg.fileOfferData.seederNodeId == msg.fileOfferData.fileInfo.originNodeId) {
                        this.addMessage(msg);
                    }
                    break;
                case PoolMessage_Type.MEDIA_OFFER:
                    if (!msg.mediaOfferData) return;
                    switch (msg.mediaOfferData.mediaType) {
                        case PoolMediaType.IMAGE:
                            let imageData: PoolImageData | undefined = msg.mediaOfferData.imageData;
                            let fileOffer: PoolFileOffer | undefined = msg.mediaOfferData.fileOffer;
                            if (!imageData || !fileOffer?.fileInfo) return;
                            if (fileOffer.fileInfo.totalSize > this.getPool().poolSettings.maxMediaSize) break;
                            this.addAvailableFileOffer(fileOffer);
                            if (fileOffer.seederNodeId != this.nodeID) {
                                FileManager.addFileDownload(this.poolID, this.poolKey, fileOffer.fileInfo, true);
                                // let addDownloadAction: AddDownloadAction = {
                                //     key: this.poolKey,
                                //     fileOffer: imageData,
                                // };
                                // store.dispatch(poolAction.addDownload(addDownloadAction));
                            }
                            this.addMessage(msg);
                            break;
                        default:
                            return;
                    }
                    break;
                case PoolMessage_Type.RETRACT_FILE_OFFER:
                    if (!msg.retractFileOfferData) return;
                    this.removeAvailableFileOffer(msg.retractFileOfferData.fileId, msg.retractFileOfferData.nodeId);
                    break;
                case PoolMessage_Type.MEDIA_HINT_REQUEST:
                    if (!msg.mediaHintRequestData) return;
                    this.sendMediaHintReply(src.nodeId, msg.mediaHintRequestData);
                    break;
                default:
                    return;
            }
        }
        
        this.broadcastMessage(msgPkgBundle, fromNodeID);
    }

    async handleChunkMessage(msgPkgBundle: PoolMessagePackageBundle, fromNodeID: string = this.nodeID) {
        let msgPkg = msgPkgBundle.msgPkg;
        let encodedMsgPkg = msgPkgBundle.encodedMsgPkg;
        if (!msgPkg.chunkInfo) return;
        let chunkInfo: PoolChunkInfo = msgPkg.chunkInfo;
        let fileSize = this.availablefileSeeders.get(chunkInfo.fileId)?.fileInfo?.totalSize;

        // MAIN CASES TO TEST
        // Center Cluster, all request
        // Request from Child node in seperate child cluster
        // Center Cluster, remove nodes: [2, 3, 4, 5, 7, 9] 1 node in each panel, different partnerInt
        // Center Cluster, remove nodes: [1, 2, 5, 6, 7, 8] 1 node in one panel, 2 nodes in other panel, different partnerInt
        // 1 Child node to Center Cluster

        // console.log("Received chunk", chunkInfo.chunkNumber);

        let partnerIntPath = getPartnerIntFromCacheChunkNumber(getCacheChunkNumberFromChunkNumber(chunkInfo.chunkNumber));
        if (partnerIntPath != msgPkg.partnerIntPath) {
            // console.log("Not same partnerIntPath", chunkInfo.chunkNumber, partnerIntPath, msgPkg.partnerIntPath);
            return;
        }

        if (msgPkg.dests.length != 0) {
            let forwardMessage = true;
            let tempChunk: Uint8Array | undefined = undefined;
            if (this.checkAtMyDest(msgPkg.dests)) {
                if (!tempChunk) tempChunk = this.getChunkFromMessagePackage(encodedMsgPkg);
                FileManager.addFileChunk(chunkInfo.fileId, chunkInfo.chunkNumber, tempChunk);
                if (msgPkg.dests.length > 1) {
                    setMessagePackageDestVisited(encodedMsgPkg, this.nodeID);
                } else {
                    forwardMessage = false;
                }
            }

            if (partnerIntPath == this.nodePosition.partnerInt && fileSize) {
                if (!tempChunk) tempChunk = this.getChunkFromMessagePackage(encodedMsgPkg);
                FileManager.cacheFileChunk(chunkInfo.fileId, chunkInfo.chunkNumber, fileSize, tempChunk)
            }

            if (!forwardMessage) return;

        } else {
            FileManager.addFileChunk(chunkInfo.fileId, chunkInfo.chunkNumber, this.getChunkFromMessagePackage(encodedMsgPkg));
        }
        
        this.broadcastMessage(msgPkgBundle, fromNodeID);
    }

    ////////////////////////////////////////////////////////////////
    // Data channel functions
    ////////////////////////////////////////////////////////////////

    broadcastMessage(msgPkgBundle: PoolMessagePackageBundle, fromNodeID: string = this.nodeID) {
        let msgPkg = msgPkgBundle.msgPkg;
        let src = msgPkg.src;
        let dests = msgPkg.dests;
        let hasDests = dests.length != 0;
        let partnerIntPath = msgPkg.partnerIntPath;
        let hasPartnerIntPath = partnerIntPath != undefined;
        if (!src) return;

        let panelNumber = this.getPanelNumber();
        let sent = false;
        let restrictToOwnPanel = hasPartnerIntPath && src.nodeId != this.nodeID && partnerIntPath != this.nodePosition.partnerInt;
        let srcPath = this.activeNodes.get(src.nodeId);
        if (!srcPath) srcPath = src.path;

        //if (typeof data == 'string') console.log("MSG SEND", data);
        // console.log("DC SEND")

        if (hasDests) {
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.parentClusterNodeIDs[panelNumber][i];
                if (i != this.nodePosition.partnerInt && nodeID != "") {
                    if (!hasPartnerIntPath || (i == partnerIntPath && nodeID != fromNodeID)) {
                        this.sendDataChannel(nodeID, msgPkgBundle);
                        sent = true;
                        break;
                    } 
                }
            }

            if (hasPartnerIntPath && sent) return;

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
                        let nodeID = this.nodePosition.parentClusterNodeIDs[i][j];
                        if (nodeID != "" && nodeID != this.nodeID && nodeID == dests[destIndex].nodeId) {
                            if (i == panelNumber && j != this.nodePosition.partnerInt) {
                                // Sets boundaries to when it's allowed to send to its own panel
                                if (
                                    !hasPartnerIntPath || 
                                    this.nodePosition.partnerInt == partnerIntPath || 
                                    partnerIntPath == j || 
                                    this.nodePosition.parentClusterNodeIDs[panelNumber][partnerIntPath!] == ""
                                ) {
                                    //console.log("SENDING TO SAME PANEL:", nodeID);
                                    this.sendDataChannel(nodeID, msgPkgBundle);
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

                let destPath = this.activeNodes.get(dests[destIndex].nodeId);
                if (!destPath) continue;

                let matches = 0;
                if (this.nodePosition.path.length <= destPath.length) {
                    for (let i = 0; i < this.nodePosition.path.length; i++) {
                        if (this.nodePosition.path[i] == destPath[i]) {
                            matches++;
                        } else {
                            matches = 0;
                            break;
                        }
                    }
                }

                if (matches == 0) {
                    if (this.nodePosition.centerCluster) {
                        this.panelSwitches[0][destPath[0]] = true;    
                    } else {
                        this.panelSwitches[0][2] = true;   
                    }
                } else {
                    if (matches >= destPath.length) {
                        continue;
                    }
                    this.panelSwitches[1][destPath[matches]] = true;   
                }

            }

            if (restrictToOwnPanel) return;

            let direction = this.getDirectionOfMessage(srcPath);

            if (direction == MessageDirection.PARENT || direction == MessageDirection.BOTH) {
                for (let i = 0; i < this.panelSwitches[0].length; i++) {
                    if (i != panelNumber && this.panelSwitches[0][i]) {
                        if (this.sendToParentClusterPanel(i, msgPkgBundle)) sent = true;
                    }
                }
            }

            if (direction == MessageDirection.CHILD || direction == MessageDirection.BOTH) {  
                for (let i = 0; i < this.panelSwitches[1].length; i++) {
                    if (this.panelSwitches[1][i]) {
                        if (this.sendToChildClusterPanel(i, msgPkgBundle)) sent = true;
                    }
                }
            }
        } else {
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.parentClusterNodeIDs[panelNumber][i];
                if (i != this.nodePosition.partnerInt && nodeID != "") {
                    if (
                        nodeID != fromNodeID && 
                        (
                            !hasPartnerIntPath || 
                            this.nodePosition.partnerInt == partnerIntPath || 
                            partnerIntPath == i || 
                            this.nodePosition.parentClusterNodeIDs[panelNumber][partnerIntPath!] == ""
                        )
                    ) {
                        this.sendDataChannel(nodeID, msgPkgBundle);
                        sent = true;
                    } 
                }
            }

            //console.log(restrictToOwnPanel);

            if (restrictToOwnPanel) return;

            let direction = this.getDirectionOfMessage(srcPath);
 
            //console.log(sendToParent, sendToChild);

            if (direction == MessageDirection.PARENT || direction == MessageDirection.BOTH) {
                for (let i = 0; i < 3; i++) {
                    if (i != panelNumber) {
                        if (this.sendToParentClusterPanel(i, msgPkgBundle)) sent = true;
                    }
                }
            }

            if (direction == MessageDirection.CHILD || direction == MessageDirection.BOTH) {
                for (let i = 0; i < 2; i++) {
                    if (this.sendToChildClusterPanel(i, msgPkgBundle)) sent = true;
                }
            }
        }
    }
    
    private getDirectionOfMessage(srcPath: number[]): MessageDirection {
        let sendToParent = false;
        let sendToChild = true;
        if (this.nodePosition.path.length < srcPath.length) {
            for (let i = 0; i < this.nodePosition.path.length; i++) {
                if (this.nodePosition.path[i] != srcPath[i]) {
                    sendToParent = false;
                    sendToChild = true;
                    break;
                } else {
                    sendToParent = true;
                    sendToChild = false;
                }
            }
        } else if (this.nodePosition.path.length == srcPath.length && this.nodePosition.path.every((v, i) => v == srcPath[i])) {
            sendToParent = true;
            sendToChild = true;
        }
        if (sendToParent && sendToChild) {
            return MessageDirection.BOTH;
        } else if (sendToParent) {
            return MessageDirection.PARENT
        } else if (sendToChild) {
            return MessageDirection.CHILD;
        }
        return MessageDirection.NONE;
    }

    private setDataChannelFunctions(nodeConnection: PoolNodeConnection, targetNodeID: string, sentOffer: boolean) {
        nodeConnection.dataChannel.binaryType = 'arraybuffer';
        nodeConnection.dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE;
        nodeConnection.dataChannel.onbufferedamountlow = () => {
            //console.log("LOW BUFFER, SENDING QUEUE OF SIZE,", this.DCBufferQueues[nodeConnection.position].length, targetNodeID);
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onopen = () => {
            console.log("DATA CHANNEL WITH", targetNodeID, "OPENED");
            if (this.new) {
                this.sendLatestRequest(targetNodeID);
            } else if (sentOffer) {
                let isNeighbourNode = false
                for (let i = 0; i < 3; i++) {
                    if (this.nodePosition.parentClusterNodeIDs[this.getPanelNumber()][i] == targetNodeID) {
                        isNeighbourNode = true;
                        break
                    }
                }
                if (isNeighbourNode) {
                    this.sendLatestRequest(targetNodeID);
                }
            }
            this.cleanMissedMessages();
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            // console.log("DC RECV", e.data, e.type);
            // console.log("DC RECV FROM:", targetNodeID, e.data);
            if (e.data.byteLength == 0) return;
            let encodedMsgPkg: Uint8Array = new Uint8Array(e.data);
            let msgPkg: PoolMessagePackage = PoolMessagePackage.decode(encodedMsgPkg);
            let msgPkgBundle: PoolMessagePackageBundle = {
                encodedMsgPkg,
                msgPkg,
            }
            if (!msgPkg.src) return;
            if (msgPkg.src.nodeId == this.nodeID) return;
            if (msgPkg.msg) {
                this.handleMessage(msgPkgBundle, targetNodeID);
            } else if (msgPkg.chunkInfo) {
                this.handleChunkMessage(msgPkgBundle, targetNodeID);
            }
        }

        nodeConnection.dataChannel.onclose = (e) => {
            reportNodeDisconnect(this.ws, targetNodeID);
            let dataChannelBufferQueue = this.DCBufferQueues[nodeConnection.position];
            for (let i = 0; i < dataChannelBufferQueue.length; i++) {
                if (this.reconnect) {
                    let replacedNodeID: string | undefined = this.getNodeFromPosition(nodeConnection.position);
                    if (replacedNodeID && replacedNodeID != "" && replacedNodeID != targetNodeID) {
                        let replacedNodeConnection = this.nodeConnections.get(replacedNodeID);
                        if (replacedNodeConnection) {
                            this.flushDCBufferQueue(replacedNodeConnection);
                        }
                    }
                }
            }
            this.cleanMissedMessages();
        }
    }

    private sendDataChannel(nodeID: string, msgPkgBundle: PoolMessagePackageBundle): boolean {
        if (nodeID == "") return false;
        let nc = this.nodeConnections.get(nodeID);
        if (!nc) return false;
        if (nc.dataChannel.readyState == 'open') {
            // console.log("DC SEND", nodeID);
            if (msgPkgBundle.msgPkg.chunkInfo) {
                if (nc.dataChannel.bufferedAmount >= MAXIMUM_DC_BUFFER_SIZE || !this.checkBufferQueueIsEmpty(nc.position)) {
                    //console.log("BUFFER SIZE", nc.dataChannel.bufferedAmount, MAXIMUM_DC_BUFFER_SIZE);
                    this.addToDCBufferQueue(nc.position, msgPkgBundle.encodedMsgPkg);
                    return true;
                }
                //console.log("DC SEND BUFFER")
            }
            nc.dataChannel.send(msgPkgBundle.encodedMsgPkg);
            return true;
        } else if (nc.dataChannel.readyState == 'connecting') {
            if (msgPkgBundle.msgPkg.chunkInfo) {
                //console.log("PUSHING BEFORE DC OPEN")
                this.addToDCBufferQueue(nc.position, msgPkgBundle.encodedMsgPkg);
                return true
            }
        }
        return false;
    }

    private sendToParentClusterPanel(panelNumber: number, msgPkgBundle: PoolMessagePackageBundle): boolean {
        let sent = false;
        let partnerIntPath = msgPkgBundle.msgPkg.partnerIntPath;
        let hasPartnerIntPath = partnerIntPath != undefined;
        if (hasPartnerIntPath) {
            if (this.sendDataChannel(this.nodePosition.parentClusterNodeIDs[panelNumber][partnerIntPath!], msgPkgBundle)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.parentClusterNodeIDs[panelNumber][i], msgPkgBundle)) sent = true;
            if (hasPartnerIntPath && sent) {
                return true;
            }
        }
        return sent;
    }

    private sendToChildClusterPanel(panelNumber: number, msgPkgBundle: PoolMessagePackageBundle): boolean {
        let sent = false;
        let partnerIntPath = msgPkgBundle.msgPkg.partnerIntPath;
        let hasPartnerIntPath = partnerIntPath != undefined;
        if (hasPartnerIntPath) {
            if (this.sendDataChannel(this.nodePosition.childClusterNodeIDs[panelNumber][partnerIntPath!], msgPkgBundle)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.childClusterNodeIDs[panelNumber][i], msgPkgBundle)) sent = true;
            if (hasPartnerIntPath && sent) {
                return true;
            }
        }
        return sent;
    }

    private getPosition(nodeID: string): number | undefined {
        let position = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.parentClusterNodeIDs[i][j] == nodeID) {
                    return position;
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.childClusterNodeIDs[i][j] == nodeID) {
                    return position;
                }
                position++;
            }
        }
        return undefined; 
    }

    private getNodeFromPosition(position: number): string | undefined {
        let nodeID: string;
        if (position < 9) {
            nodeID = this.nodePosition.parentClusterNodeIDs[Math.floor(position/3)][position % 3];
        } else {
            position -= 9;
            nodeID = this.nodePosition.childClusterNodeIDs[Math.floor(position/3)][position % 3];
        }
        if (nodeID == "") {
            return undefined;
        }
        return nodeID;
    }

    private cleanMissedMessages(orAddMessage?: PoolMessage): boolean {
        let cleaned = true;
        this.nodeConnections.forEach((nodeConnection) => {
            if (nodeConnection.dataChannel.readyState == 'connecting') {
                cleaned = false;
            }
        });
        // console.log("Cleaned missed messages", cleaned);
        if (cleaned) {
            if (this.missedMessages.length != 0) {
                this.missedMessages = [];
            }
        } else if (orAddMessage) {
            this.missedMessages.push(orAddMessage);
        }
        return cleaned;
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

    private checkForUneededBufferQueues() {
        let position = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.parentClusterNodeIDs[i][j] == "") {
                    this.curDCBufferQueueLength -= this.DCBufferQueues[position].length;
                    this.DCBufferQueues[position] = [];
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.childClusterNodeIDs[i][j] == "") {
                    this.curDCBufferQueueLength -= this.DCBufferQueues[position].length;
                    this.DCBufferQueues[position] = [];
                }
                position++;
            }
        }
        this.triggerDCBufferAvailableToFill();
    }

    private flushDCBufferQueue(nodeConnection: PoolNodeConnection) {
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

    // This will trigger frequently which is ok because we don't want any data channels sitting idle
    // due to the fact that curDCBufferQueueLength is shared
    private triggerDCBufferAvailableToFill() {
        // console.log("PRE TRIGGER DC BUFFER FILL", this.curDCBufferQueueLength, this.maxDCBufferQueueLength - LOW_BUFFER_THRESHOLD);
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
        //console.log(this.receivedMessages, msg);
        let poolMessageExists: boolean = false;
        for (let i = this.receivedMessages.length - 1; i >= 0; i--) {
            //console.log(msg.created, msg.created && this.receivedMessages[i].received < msg.created, this.receivedMessages[i].msgID, msg.msgID)
            if (msg.created && this.receivedMessages[i].created < msg.created) {
                break;
            } else {
                if (this.receivedMessages[i].msgID == msg.msgId) {
                    poolMessageExists = true;
                }
            }
        }

        //console.log(poolMessageExists);
        if (poolMessageExists) return true;

        let msgInfo: PoolMessageInfo = {
            msgID: msg.msgId,
            created: msg.created,
        }

        if (this.receivedMessages.length == 0) {
            this.receivedMessages.push(msgInfo);
            return false;
        }
        for (let i = this.receivedMessages.length; i >= 0; i--) {
            if (i == 0 || msg.created >= this.receivedMessages[i - 1].created) {
                this.receivedMessages.splice(i, 0, msgInfo);
                break;
            }
        }

        if (this.receivedMessages.length > DEFAULT_RECV_MESSAGES_CACHE) {
            this.receivedMessages.shift();
        }

        return false;
    }

    private addMessage(message: PoolMessage) {
        //console.log("ADDING MESSAGE", message);
        // if (this.isPromoting) { // this.isPromoting
        //     this.missedMessages.push(message);
        // }
        this.cleanMissedMessages(message);
        store.dispatch(poolAction.addMessage({
            key: this.poolKey,
            message: message,
        } as AddMessageAction));
    }

    private addAndCheckMessage(msg: PoolMessage) {
        if (!this.checkMessageDuplicate(msg)) {
            this.addMessage(msg);
        }
    }

    private addMessages(messages: PoolMessage[]) {
        for (const message of messages) {
            if (!this.checkMessageDuplicate(message)) {
                if (message.type == PoolMessage_Type.FILE_OFFER) {
                    if (!message.fileOfferData) continue;
                    this.addAvailableFileOffer(message.fileOfferData);
                } else if (message.type == PoolMessage_Type.MEDIA_OFFER) {
                    if (!message.mediaOfferData?.fileOffer) continue;
                    this.addAvailableFileOffer(message.mediaOfferData.fileOffer);
                }
                this.addMessage(message);
            }
        }
    }

    private createNodeStateMsgID(nodeID: string, timestamp: number, state: PoolNodeState): string {
        return nodeID + timestamp + state.toString();
    }

    private checkAtMyDest(dests: PoolMessagePackageDestinationInfo[]): boolean {
        for (let i = 0; i < dests.length; i++) {
            if (dests[i].nodeId == this.nodeID) {
                return !dests[i].visited;
            }
        }
        return false;
    }

    private getSrc(): PoolMessagePackageSourceInfo {
        return {
            nodeId: this.nodeID,
            path: this.nodePosition.path,
        };
    }

    private getDests(destNodeIDs: string[] | string): PoolMessagePackageDestinationInfo[] {
        if (typeof destNodeIDs == 'string') {
            destNodeIDs = [destNodeIDs];
        }
        let dests: PoolMessagePackageDestinationInfo[] = [];
        for (let i = 0; i < destNodeIDs.length; i++) {
            let dest: PoolMessagePackageDestinationInfo = {
                nodeId: destNodeIDs[i],
                visited: destNodeIDs[i] == this.nodeID,
            };
            dests.push(dest);
        }
        return dests;
    }

    private createNewMessage(type: PoolMessage_Type, msgID: string = nanoid(MESSAGE_ID_LENGTH)) {
        let msg: PoolMessage = {
            msgId: msgID,
            type,
            userId: getStoreState().profile.userID,
            created: Date.now(),
        }
        return msg;
    }

    private createNewMessagePackage(destNodeIDs?: string[] | string, partnerIntPath?: number): PoolMessagePackage {
        let src = this.getSrc();
        let dests = destNodeIDs ? this.getDests(destNodeIDs) : [];
        let messagePackage: PoolMessagePackage = {
            src,
            dests,
            // hasPartnerIntPath: partnerIntPath != undefined,
            partnerIntPath: partnerIntPath,
        }
        return messagePackage;
    }

    private createMessagePackageBundle(msg: PoolMessage, destNodeIDs?: string[] | string, partnerIntPath?: number): PoolMessagePackageBundle {
        let msgPkg: PoolMessagePackage = this.createNewMessagePackage(destNodeIDs, partnerIntPath);
        msgPkg.msg = msg;
        return {
            msgPkg,
            encodedMsgPkg: PoolMessagePackage.encode(msgPkg).finish(),
        };
    }

    private createChunkMessagePackageBundle(chunkInfo: PoolChunkInfo, chunk: Uint8Array, destNodeIDs?: string[] | string): PoolMessagePackageBundle {
        let partnerIntPath = getPartnerIntFromCacheChunkNumber(getCacheChunkNumberFromChunkNumber(chunkInfo.chunkNumber));
        let msgPkg: PoolMessagePackage = this.createNewMessagePackage(destNodeIDs, partnerIntPath);
        msgPkg.chunkInfo = chunkInfo;
        msgPkg.partnerIntPath = partnerIntPath;
        let msgPkgWithChunk: PoolMessagePackageWithChunk = msgPkg;
        msgPkgWithChunk.chunk = chunk;
        return {
            msgPkg,
            encodedMsgPkg: PoolMessagePackageWithChunk.encode(msgPkgWithChunk).finish(),
        };
    }

    private getChunkFromMessagePackage(encodedMsgPkg: Uint8Array): Uint8Array {
        return PoolMessagePackageWithOnlyChunk.decode(encodedMsgPkg).chunk || new Uint8Array();
    }

    ////////////////////////////////////////////////////////////////
    // PoolMessage helpers functions
    ////////////////////////////////////////////////////////////////

    private getDistanceTo(lastSeenPath: number[]): number {
        let matches = 0;
        for (; matches < Math.min(this.nodePosition.path.length, lastSeenPath.length); matches++) {
            if (this.nodePosition.path[matches] != lastSeenPath[matches]) break;
        }
        return (this.nodePosition.path.length - matches) + (lastSeenPath.length - matches);
    }
}

function initializeRTCPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]})
}

function initializeMainDataChannel(connection: RTCPeerConnection): RTCDataChannel {
    return connection.createDataChannel("main", {
        ordered: false,
        negotiated: true,
        id: 0,
    });
}