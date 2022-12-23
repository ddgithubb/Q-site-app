import { SSNodeStatusData, SSReportCodes, SSReportNodeData, SSSDPData, SSStatus, SSMessage, SSAddNodesData, SSRemoveNodeData } from "./sync-server.model";
import { PoolNodeState, Pool, PoolUpdateLatestInfo, PoolMessagePackage, PoolMessageType, PoolNode, PoolMessageAction, PoolUpdateNodeState, PoolFileRequest, PoolMessageSourceInfo, PoolMessageDestinationInfo, MESSAGE_ID_LENGTH, FILE_ID_LENGTH, PoolMessageInfo, PoolChunkRange, PoolImageOffer, PoolDownloadProgressStatus, PoolRequestMediaHint, PoolMessage, PoolRemoveFileRequest, PoolRetractFileOffer, PoolFileInfo, PoolFileOffer, PoolFileOfferAndSeeders } from "./pool.model";
import { getStoreState, store } from "../store/store";
import { AddActiveNodeAction, AddDownloadAction, AddFileOfferAction, AddMessageAction, PoolAction, poolAction, RemoveActiveNodeAction, RemoveFileOfferAction, RemoveUserAction, ResetPoolAction, UpdateDownloadProgressStatusAction, UpdateUserAction } from "../store/slices/pool.slice";
import { CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CHUNK_SIZE, DEFAULT_RECV_MESSAGES_CACHE, MAXIMUM_GET_LATEST_MESSAGE_LENGTH } from "../config/caching";
import { nanoid } from "nanoid";
import { createBinaryMessage, parseBinaryMessage, setBinaryMessageDestVisited } from "./pool-binary-message";
import { FileManager, PoolManager } from "./global";
import { SendSSMessage } from "./sync-server-client";
import { compactChunkRanges, getCacheChunkNumberFromByteSize, getCacheChunkNumberFromChunkNumber, searchPosInCacheChunkMapData } from "./pool-chunks";
import { CacheChunkData, CacheChunkMapData, FileOfferData } from "./pool-file-manager";
import { mebibytesToBytes } from "../helpers/file-size";
import EventEmitter from "events";
import { Image } from 'image-js';
import { checkFileExist } from "../helpers/file-exists";
import { profileAction, ProfileState } from "../store/slices/profile.slice";

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

interface NodeConnection {
    position: number;
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
}

interface NodePosition {
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodeIDs: string[][];
    ChildClusterNodeIDs: string[][];
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
    fileOfferAndSeeders: PoolFileOfferAndSeeders;
    lastRequestedNodeID: string;
    lastProgress: number;
    retryCount: number;
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
                FileManager.completeFileDownload(dq[i].fileOffer.fileID);
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
            // let profileState = getStoreState().profile;
            // let fileOffers: FileOffer[] = FileManager.getFileOffers(this.poolID) || [];
            // let poolFileInfos: PoolFileInfo[] = fileOffers.map((fileOffer) => {
            //     return {
            //         ...fileOffer,
            //         file: undefined,
            //     };
            // });
            // let myNode: PoolNode = {
            //     nodeID: this.nodeID,
            //     userID: profileState.userID,
            //     deviceID: profileState.device.DeviceID,
            //     state: PoolNodeState.ACTIVE,
            //     lastSeenPath: this.nodePosition.Path,
            //     fileOffers: poolFileInfos,
            // };
            store.dispatch(poolAction.resetPool({
                key: this.poolKey,
                //myNode: myNode,
            } as ResetPoolAction));
            console.log("NodeID", this.nodeID)
            this.new = false;

            if (nodePosition.CenterCluster) {
                let onlyNode = true;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (nodePosition.ParentClusterNodeIDs[i][j] != "" && nodePosition.ParentClusterNodeIDs[i][j] != this.nodeID) {
                            onlyNode = false;
                            break;
                        }
                    }
                    if (!onlyNode) break;
                }
                if (onlyNode) {
                    this.latest = true;
                    //this.addActiveNodeMessage(this.createMessage(PoolMessageType.NODE_STATUS, PoolMessageAction.DEFAULT, myNode));
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

    disconnectNode(targetNodeID: string) {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        if (nodeConnection){
            this.closeNodeConnection(nodeConnection);
            this.nodeConnections.delete(targetNodeID);
        }
        // if (disconnectData.RemoveFromPool) {
        //     this.sendInactiveNodeSignal(targetNodeID);
        // }
    }

    verifyConnection(targetNodeID: string): boolean {
        let nodeConnection = this.nodeConnections.get(targetNodeID);
        if (!nodeConnection || nodeConnection.dataChannel.readyState != 'open') {
            return false;
        }
        return true;
    }

    addNodes(addNodesData: SSAddNodesData) {
        for (const node of addNodesData) {
            let myNode = node.NodeID == this.nodeID;
            
            // TEMP (although update user is needed, it should be done with another function)
            let updateUserAction: UpdateUserAction = {
                key: this.poolKey,
                nodeInfo: node.NodeInfo,
            };
            store.dispatch(poolAction.updateUser(updateUserAction));
            if (myNode) {
                store.dispatch(profileAction.initProfile({
                    userID: node.NodeInfo.UserID,
                    device: {
                        DeviceID: node.NodeInfo.DeviceID,
                        DeviceName: node.NodeInfo.DeviceName,
                        DeviceType: node.NodeInfo.DeviceType,
                    },
                } as ProfileState))
            }
            // TEMP
            
            let poolNode: PoolNode = {
                nodeID: node.NodeID,
                userID: node.NodeInfo.UserID,
                deviceID: node.NodeInfo.DeviceID,
                fileOffers: [],
            };

            if (myNode) {
                let fileOffersData: FileOfferData[] = FileManager.getFileOffers(this.poolID) || [];
                let fileOffers: PoolFileOffer[] = fileOffersData.map((fileOffer) => {
                    return {
                        ...fileOffer,
                        seederNodeID: this.nodeID,
                        file: undefined,
                    };
                });
                poolNode.fileOffers = fileOffers;
            }

            this.activeNodes.set(node.NodeID, node.Path);
            store.dispatch(poolAction.addActiveNode({
                key: this.poolKey,
                node: poolNode,
            } as AddActiveNodeAction));
            
            if (this.latest || myNode) {
                let updateNodeState: PoolUpdateNodeState = {
                    nodeID: poolNode.nodeID,
                    userID: poolNode.userID,
                    state: PoolNodeState.ACTIVE,
                };
                let msg: PoolMessage = this.createMessage(PoolMessageType.NODE_STATE, updateNodeState, this.createNodeStateMsgID(node.NodeID, node.Timestamp, PoolNodeState.ACTIVE));
                msg.created = node.Timestamp;
                this.addAndCheckMessage(msg);
            }
        }
    }

    removeNode(removeNodeData: SSRemoveNodeData) {
        let nodeID: string = removeNodeData.NodeID;

        this.activeNodes.delete(nodeID);

        let existingNode: PoolNode | undefined = undefined;
        for (const node of this.getPool().activeNodes) {
            if (node.nodeID == nodeID) {
                existingNode = node;
                break;
            }
        }
        if (!existingNode) return;

        // TEMP
        store.dispatch(poolAction.removeUser({
            key: this.poolKey,
            userID: existingNode.userID, 
        } as RemoveUserAction));
        // TEMP

        for (let i = 0; i < existingNode.fileOffers.length; i++) {
            this.removeAvailableFileOffer(existingNode.fileOffers[i].fileID, nodeID);
            // FileManager.completeFileDownload(existingNode.fileOffers[i].fileID);
        }

        store.dispatch(poolAction.removeActiveNode({
            key: this.poolKey,
            nodeID: nodeID,
        } as RemoveActiveNodeAction));

        let updateNodeState: PoolUpdateNodeState = {
            nodeID: nodeID,
            userID: existingNode.userID,
            state: PoolNodeState.INACTIVE,
        };

        let msg: PoolMessage = this.createMessage(PoolMessageType.NODE_STATE, updateNodeState, this.createNodeStateMsgID(nodeID, removeNodeData.Timestamp, PoolNodeState.INACTIVE));
        msg.created = removeNodeData.Timestamp;
        this.addAndCheckMessage(msg);
        
        for (const promotedNode of removeNodeData.PromotedNodes) {
            this.activeNodes.set(promotedNode.NodeID, promotedNode.Path);
        }
    }

    ////////////////////////////////////////////////////////////////
    // Send to pool functions
    ////////////////////////////////////////////////////////////////

    // sendActiveNodeSignal(nodeID: string) {
    //     this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.NODE_STATUS, PoolMessageAction.DEFAULT, this.getPool().myNode)));
    // }

    // sendInactiveNodeSignal(nodeID: string) {
    //     let userID = "";
    //     for (const node of this.getPool().activeNodes) {
    //         if (node.nodeID == nodeID) {
    //             userID = node.userID;
    //             break;
    //         }
    //     }
    //     this.handleMessage(this.createMessage(PoolMessageType.NODE_STATUS, PoolMessageAction.DEFAULT, {
    //         nodeID: nodeID,
    //         userID: userID,
    //         state: PoolNodeState.INACTIVE,
    //     } as PoolUpdateNodeState));
    // }

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
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessagePackage(PoolMessageType.GET_LATEST, PoolMessageAction.REQUEST, {
            messagesOnly: !this.latest ? false : true, //!this.latest ? false : pool.activeNodes.length != 0 ? false : true
            lastMessageID: lastMessageID,
            messages: lastMessageID != "" ? messages : [],
        } as PoolUpdateLatestInfo, nodeID)));
    }

    sendRespondGetLatest(nodeID: string, latestRequest: PoolUpdateLatestInfo) {
        let pool = this.getPool();
        let messagesOnly = latestRequest.messagesOnly;
        let lastMessageID = latestRequest.lastMessageID;

        if (lastMessageID != "") {
            this.addMessages(latestRequest.messages)
        }

        let fileOffersAndSeeders: PoolFileOfferAndSeeders[] = [];
        this.availableFiles.forEach((availFile) => {
            fileOffersAndSeeders.push(availFile.fileOfferAndSeeders);
        });

        let latest: PoolUpdateLatestInfo = {
            messagesOnly: messagesOnly,
            lastMessageID: lastMessageID,
            fileOffersAndSeeders: fileOffersAndSeeders,
            //activeNodes: messagesOnly ? [] : pool.activeNodes,
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
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessagePackage(PoolMessageType.GET_LATEST, PoolMessageAction.REPLY, latest, nodeID)))
    }

    sendTextMessage(text: string) {
        this.handleMessage(this.createMessagePackage(PoolMessageType.TEXT, PoolMessageAction.DEFAULT, text.trim()));
    }

    sendFileOffer(file: File, fileID: string = nanoid(FILE_ID_LENGTH), originNodeID: string = this.nodeID) {
        let fileOffer: PoolFileOffer = {
            fileID: fileID,
            seederNodeID: this.nodeID,
            originNodeID: originNodeID,
            fileName: file.name,
            totalSize: file.size,
        };
        if (!FileManager.addFileOffer(this.poolID, fileOffer, file)) return;
        this.handleMessage(this.createMessagePackage(PoolMessageType.FILE_OFFER, PoolMessageAction.DEFAULT, fileOffer));
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
        let imageOffer: PoolImageOffer = {
            fileID: fileID,
            seederNodeID: this.nodeID,
            originNodeID: this.nodeID,
            fileName: file.name,
            totalSize: file.size,
            extension: format,
            width: width,
            height: height,
            previewImage: previewImage,
        }
        if (!FileManager.addFileOffer(this.poolID, imageOffer, file)) return;
        FileManager.addMediaCache(fileID, file);
        this.handleMessage(this.createMessagePackage(PoolMessageType.IMAGE_OFFER, PoolMessageAction.DEFAULT, imageOffer));
        this.sendMedia(fileID);
    }

    async sendRequestFile(fileInfo: PoolFileInfo, isMedia: boolean, chunksMissing?: PoolChunkRange[], hinterNodeID?: string) {
        if (FileManager.hasFileOffer(this.poolID, fileInfo.fileID)) {
            let exists = await this.validateFileOffer(fileInfo.fileID);
            if (exists) return;
        }

        //console.log(FileManager.hasFileDownload(fileInfo.fileID), chunksMissing, hinterNodeID);
        if (!FileManager.hasFileDownload(fileInfo.fileID)) {
            if (!(await FileManager.addFileDownload(this.poolID, this.poolKey, fileInfo, isMedia))) return;
            let addDownloadAction: AddDownloadAction = {
                key: this.poolKey,
                fileInfo: fileInfo,
            };
            store.dispatch(poolAction.addDownload(addDownloadAction));
        } else if (!chunksMissing  && !hinterNodeID) return;


        let availableFile = this.availableFiles.get(fileInfo.fileID);
        
        //console.log(availableFile, fileInfo.fileID);
        let requestNodeID = "";
        if (availableFile) {
            let seederNodeIDs = availableFile.fileOfferAndSeeders.seederNodeIDs;
            if (seederNodeIDs.length == 1) {
                requestNodeID = seederNodeIDs[0];
            } else {
                let minimumDist = Infinity;
                for (let i = 0; i < seederNodeIDs.length; i++) {
                    let lsp = this.activeNodes.get(seederNodeIDs[i]);
                    if (!lsp) continue;
                    let dist = this.getDistanceTo(lsp);
                    if (dist < minimumDist) {
                        requestNodeID = seederNodeIDs[i];
                        minimumDist = dist;
                    }
                }
            }

            if (requestNodeID != "") {
                if (requestNodeID == availableFile.lastRequestedNodeID && availableFile.retryCount > MAX_FILE_REQUEST_RETRY) {
                    let updateDownloadStatusAction: UpdateDownloadProgressStatusAction = {
                        key: this.poolKey,
                        fileID: fileInfo.fileID,
                        seederNodeID: requestNodeID,
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
                seederNodeID: requestNodeID,
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
                    this.handleMessage(this.createMessagePackage(PoolMessageType.FILE_OFFER, PoolMessageAction.REQUEST, fileRequest, requestNodeID, i));
                }
            }
        } else {
            //FileManager.completeFileDownload(fileInfo.fileID);
            let updateDownloadStatusAction: UpdateDownloadProgressStatusAction = {
                key: this.poolKey,
                fileID: fileInfo.fileID,
                seederNodeID: "",
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
        this.handleMessage(this.createMessagePackage(PoolMessageType.REQUEST_MEDIA_HINT, PoolMessageAction.DEFAULT, requestingHintData));
    }

    sendReplyMediaHint(originNodeID: string, requestingHintData: PoolRequestMediaHint) {
        if (!FileManager.hasMediaCache(requestingHintData.fileInfo.fileID)) return;
        this.handleMessage(this.createMessagePackage(PoolMessageType.REQUEST_MEDIA_HINT, PoolMessageAction.REPLY, requestingHintData, originNodeID));
    }

    sendRequestMediaFromHint(hinterNodeID: string, requestingHintData: PoolRequestMediaHint) {
        if (!FileManager.hasFileDownload(requestingHintData.fileInfo.fileID)) return;
        this.sendRequestFile(requestingHintData.fileInfo, true, undefined, hinterNodeID);
    }

    sendRetractFileOffer(fileID: string) {
        if (!FileManager.hasFileOffer(this.poolID, fileID)) return;
        FileManager.removeFileOffer(this.poolID, fileID);
        let retractFileOfferData: PoolRetractFileOffer = { fileID, nodeID: this.nodeID };
        this.handleMessage(this.createMessagePackage(PoolMessageType.RETRACT_FILE_OFFER, PoolMessageAction.DEFAULT, retractFileOfferData));
    }

    sendRemoveFileRequest(fileOffer: PoolFileOffer) {
        if (!FileManager.hasFileDownload(fileOffer.fileID)) return;
        FileManager.completeFileDownload(fileOffer.fileID);
        if (fileOffer.seederNodeID == "") return;
        let removeFileRequestData: PoolRemoveFileRequest = {
            requestingNodeID: this.nodeID,
            fileID: fileOffer.fileID,
        };
        this.handleMessage(this.createMessagePackage(PoolMessageType.REMOVE_FILE_REQUEST, PoolMessageAction.REQUEST, removeFileRequestData, fileOffer.seederNodeID));
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
                this.sendRetractFileOffer(fileRequest.fileID);
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
        let fileOfferData: FileOfferData | undefined = FileManager.getFileOffer(this.poolID, fileID);
        if (!fileOfferData) return;

        let chunkNumber = 0;
        let partnerIntPath = 0;
        let totalChunks = Math.ceil(fileOfferData.file.size / CHUNK_SIZE);

        let fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            if (e.target?.error != null) {
                this.sendRetractFileOffer(fileID);
            }
            if (!e.target) return;
            if (!FileManager.hasFileOffer(this.poolID, fileID) && !FileManager.hasMediaCache(fileID)) return;
            partnerIntPath = getCacheChunkNumberFromChunkNumber(chunkNumber) % 3;
            this.sendChunk(fileID, chunkNumber++, e.target.result as ArrayBuffer, undefined, partnerIntPath, nextChunk);
        }

        let nextChunk = () => {
            if (chunkNumber >= totalChunks) return;
            let offset = chunkNumber * CHUNK_SIZE;

            fileReader.readAsArrayBuffer(fileOfferData!.file.slice(offset, offset + CHUNK_SIZE));
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
            let totalSize = this.availableFiles.get(poolFileRequest.fileID)!.fileOfferAndSeeders.totalSize;
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
            let cacheChunkMapData = FileManager.getCacheChunkMapData(poolFileRequest.fileID);
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

    addAvailableFileOffer(fileOffer: PoolFileOffer) {
        let availableFile = this.availableFiles.get(fileOffer.fileID);
        console.log("ADDING AVAILABLE FILE", fileOffer.fileID);
        if (!availableFile) {
            availableFile = {
                fileOfferAndSeeders: {
                    fileID: fileOffer.fileID,
                    originNodeID: fileOffer.originNodeID,
                    fileName: fileOffer.fileName,
                    totalSize: fileOffer.totalSize,
                    seederNodeIDs: [],
                },
                lastRequestedNodeID: "",
                lastProgress: 0,
                retryCount: 0,
            };
            this.availableFiles.set(fileOffer.fileID, availableFile);
            //console.log("SETTING AVAILABLE FILE", this.availableFiles.size);
        } else if (fileOffer.totalSize != availableFile.fileOfferAndSeeders.totalSize) return;
        //console.log(availableFile.fileOfferAndSeeders.seederNodeIDs.length, availableFile.fileOfferAndSeeders.seederNodeIDs.includes(fileOffer.seederNodeID), fileOffer.seederNodeID)
        if (!availableFile.fileOfferAndSeeders.seederNodeIDs.includes(fileOffer.seederNodeID)) {
            availableFile.fileOfferAndSeeders.seederNodeIDs.push(fileOffer.seederNodeID);
            store.dispatch(poolAction.addFileOffer({
                key: this.poolKey,
                fileOffer: fileOffer,
            } as AddFileOfferAction));
            //console.log(this.getPool().Users, this.getPool().myNode);
        }
    }

    removeAvailableFileOffer(fileID: string, nodeID: string) {
        let availableFile = this.availableFiles.get(fileID);
        if (!availableFile) return;
        let seederNodeIDs = availableFile.fileOfferAndSeeders.seederNodeIDs;
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
        if (seederNodeIDs.length == 0) this.availableFiles.delete(fileID);
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

    updateLatest(updateLatestInfo: PoolUpdateLatestInfo) {
        this.addMessages(updateLatestInfo.messages);
        if (!updateLatestInfo.messagesOnly) {
            store.dispatch(poolAction.clearFileOffers({ key: this.poolKey } as PoolAction));
            this.availableFiles.clear();
            for (const fileOfferAndSeeders of updateLatestInfo.fileOffersAndSeeders) {
                for (const seederNodeID of fileOfferAndSeeders.seederNodeIDs) {
                    let fileOffer: PoolFileOffer = {
                        ...fileOfferAndSeeders,
                        seederNodeID: seederNodeID,
                    }
                    this.addAvailableFileOffer(fileOffer);
                }
            }
            // store.dispatch(poolAction.updateActiveNodes({
            //     key: this.poolKey,
            //     activeNodes: updateLatestInfo.activeNodes,
            // } as UpdateActiveNodesAction));
            // this.activeNodes.clear();
            // this.availableFiles.clear();
            // // ADD OWN NODE
            // for (let i = 0; i < updateLatestInfo.activeNodes.length; i++) {
            //     let node = updateLatestInfo.activeNodes[i];
            //     this.activeNodes.set(node.nodeID, node.lastSeenPath);
            //     for (let j = 0; j < node.fileOffers.length; j++) {
            //         this.addAvailableFileOffer(node.fileOffers[j]);
            //     }
            // }
        }
        this.latest = true;
    }

    // addActiveNode(node: PoolNode): boolean {
    //     //console.log("ADDING ACTIVE NODE", msg.data.nodeID, this.activeNodes.has(msg.data.nodeID));
    //     if (this.activeNodes.has(node.nodeID)) return false;
    //     this.activeNodes.set(node.nodeID, node.lastSeenPath);
    //     store.dispatch(poolAction.addActiveNode({
    //         key: this.poolKey,
    //         node: node,
    //     } as AddActiveNodeAction));
    //     for (let i = 0; i < node.fileOffers.length; i++) {
    //         this.addAvailableFileOffer(node.fileOffers[i]);
    //     }
    //     //console.log(this.getPool().activeNodes);
    //     return true;
    // }

    // removeActiveNode(nodeUpdate: PoolUpdateNodeState) {
    //     let nodeID: string = nodeUpdate.nodeID;
    //     if (!this.activeNodes.has(nodeID)) return false;
    //     this.activeNodes.delete(nodeID);
    //     let existingNode: PoolNode | undefined = undefined;
    //     for (const node of this.getPool().activeNodes) {
    //         if (node.nodeID == nodeID) {
    //             existingNode = node;
    //             break;
    //         }
    //     }
    //     if (existingNode) {
    //         for (let i = 0; i < existingNode.fileOffers.length; i++) {
    //             this.removeAvailableFileOffer(existingNode.fileOffers[i].fileID, nodeID);
    //             // FileManager.completeFileDownload(existingNode.fileOffers[i].fileID);
    //         }
    //         store.dispatch(poolAction.removeActiveNode({
    //             key: this.poolKey,
    //             nodeID: nodeID,
    //         } as RemoveActiveNodeAction));
    //     }
    //     return true;
    // }

    // addActiveNodeMessage(msg: PoolMessageView) {
    //     if (this.addActiveNode(msg.data)) this.addMessage(msg);
    // }

    // removeActiveNodeMessage(msg: PoolMessageView) {
    //     if (this.removeActiveNode(msg.data)) this.addMessage(msg);
    // }

    removeFileRequest(removeFileRequestData: PoolRemoveFileRequest) {
        let fileRequests = this.curFileRequests.get(removeFileRequestData.fileID);
        if (!fileRequests) return;
        for (let i = 0; i < fileRequests.length; i++) {
            if (fileRequests[i].requestingNodeID == removeFileRequestData.requestingNodeID) {
                fileRequests.splice(i, 1);
                break;
            }
        }
    }

    completeFileDownload(fileID: string) {
        this.mediaHinterNodeIDs.delete(fileID);
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage functions
    ////////////////////////////////////////////////////////////////

    handleMessage(messagePackage: PoolMessagePackage, fromNodeID: string = this.nodeID) {
        let src = messagePackage.src;
        let dests = messagePackage.dests;
        let action = messagePackage.action;
        let partnerIntPath = messagePackage.partnerIntPath;
        let msg = messagePackage.msg;
        if (this.checkMessageDuplicate(msg)) return;

        console.log("MSG RECV:", JSON.stringify(msg));

        if (dests) {
            let isADest: boolean = this.checkAtMyDest(dests);
            switch (msg.type) {
            case PoolMessageType.GET_LATEST:
                if (isADest) {
                    if (action == PoolMessageAction.REQUEST) {
                        this.sendRespondGetLatest(src.nodeID, msg.data);
                    } else if (action == PoolMessageAction.REPLY) {
                        this.updateLatest(msg.data);
                    }
                }
                break;
            case PoolMessageType.FILE_OFFER:
                if (isADest) {
                    if (action == PoolMessageAction.REQUEST) {
                        this.sendFile(msg.data);
                    }
                } else {
                    if (action == PoolMessageAction.REQUEST) {
                        if (partnerIntPath != null) {
                            this.addAndSendChunksCovered(msg.data, partnerIntPath);
                        }
                    }
                }
                break;
            case PoolMessageType.REMOVE_FILE_REQUEST:
                if (isADest) {
                    if (action == PoolMessageAction.REQUEST) {
                        this.removeFileRequest(msg.data);
                    }
                }
                break;
            case PoolMessageType.REQUEST_MEDIA_HINT:
                if (isADest) {
                    if (action == PoolMessageAction.REPLY) {
                        this.sendRequestMediaFromHint(src.nodeID, msg.data);
                    }
                }
                break;
            default:
                return;
            }
            if (isADest && dests.length == 1) return;
        } else {
            let isPersistent = this.handlePersistentMessages(msg);
            if (!isPersistent) {
                switch (msg.type) {
                // case PoolMessageType.NODE_STATUS:
                //     if (msg.data.state == PoolNodeState.ACTIVE) {
                //         this.addActiveNodeMessage(msg);
                //     } else if (msg.data.state == PoolNodeState.INACTIVE) {
                //         this.removeActiveNodeMessage(msg);
                //     } else {
                //         return
                //     }
                //     break;
                
                case PoolMessageType.RETRACT_FILE_OFFER:
                    let removeAvailableFileOfferData: PoolRetractFileOffer = msg.data;
                    this.removeAvailableFileOffer(removeAvailableFileOfferData.fileID, removeAvailableFileOfferData.nodeID);
                    break;
                case PoolMessageType.REQUEST_MEDIA_HINT:
                    if (action == PoolMessageAction.DEFAULT) {
                        this.sendReplyMediaHint(src.nodeID, msg.data);
                    }
                    break;
                default:
                    return
                }
            }
        }
        
        let data = JSON.stringify(messagePackage);
        this.broadcastMessage(data, src, dests, fromNodeID, partnerIntPath);
    }

    handlePersistentMessages(msg: PoolMessage): boolean {
        switch (msg.type) {
            case PoolMessageType.TEXT:
                let text: string = msg.data;
                if (text == "" || text.length >= this.getPool().PoolSettings.maxTextLength || text.replaceAll(" ", "").replaceAll("&nbsp;", "").replaceAll("<br>", "") == "") {
                    break;
                }
                this.addMessage(msg);
                break;
            case PoolMessageType.FILE_OFFER:
                let fileOffer: PoolFileOffer = msg.data;
                this.addAvailableFileOffer(fileOffer);
                if (fileOffer.seederNodeID == fileOffer.originNodeID) {
                    this.addMessage(msg);
                }
                break;
            case PoolMessageType.IMAGE_OFFER:
                let imageOffer: PoolImageOffer = msg.data;
                if (imageOffer.totalSize > this.getPool().PoolSettings.maxMediaSize) break;
                this.addAvailableFileOffer(imageOffer);
                if (imageOffer.seederNodeID != this.nodeID) {
                    FileManager.addFileDownload(this.poolID, this.poolKey, imageOffer, true);
                    let addDownloadAction: AddDownloadAction = {
                        key: this.poolKey,
                        fileInfo: imageOffer,
                    };
                    store.dispatch(poolAction.addDownload(addDownloadAction));
                }
                this.addMessage(msg);
                //this.sendRequestFile(msg.data.fileInfo, [], false, true);
                break;
            default:
                return false;
        }
        return true;
    }

    async handleBinaryMessage(binaryData: ArrayBuffer, fromNodeID: string = this.nodeID) {
        let data = new Uint8Array(binaryData);

        let parsedMsg = parseBinaryMessage(data)
        if (!parsedMsg) return; //report

        //let { payload, fileID, chunkNumber, src, dests } = parsedMsg;

        if (parsedMsg.payload.byteLength == 0) return;
        let fileSize = this.availableFiles.get(parsedMsg.fileID)?.fileOfferAndSeeders.totalSize;

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
        // console.log("FORWARD CHUNKNUMBER", parsedMsg.chunkNumber, parsedMsg.dests);

        //let isADest = false;
        let partnerIntPath = getCacheChunkNumberFromChunkNumber(parsedMsg.chunkNumber) % 3;
        if (parsedMsg.dests) {
            let forwardMessage = true;
            if (this.checkAtMyDest(parsedMsg.dests)) {
                FileManager.addFileChunk(parsedMsg.fileID, parsedMsg.chunkNumber, parsedMsg.payload);
                if (parsedMsg.dests.length != 1) {
                    // if (partnerIntPath != this.nodePosition.PartnerInt) console.log("GOT MY FILE CHUNK, SENDING TO DESTS", dests) // Problem, is it's sending to other panels of a partnerInt that is not itself
                    //isADest = true;
                    //data = createBinaryMessage(payload, msgID, fileID, chunkNumber, src, dests);
                    setBinaryMessageDestVisited(data, parsedMsg, this.nodeID);
                } else {
                    forwardMessage = false;
                }
            }

            if (partnerIntPath == this.nodePosition.PartnerInt && fileSize) {
                FileManager.cacheFileChunk(parsedMsg.fileID, parsedMsg.chunkNumber, fileSize, parsedMsg.payload)
            }

            if (!forwardMessage) return;

        } else {
            FileManager.addFileChunk(parsedMsg.fileID, parsedMsg.chunkNumber, parsedMsg.payload);
        }
        
        this.broadcastMessage(data, parsedMsg.src, parsedMsg.dests, fromNodeID, partnerIntPath);
    }

    ////////////////////////////////////////////////////////////////
    // Data channel functions
    ////////////////////////////////////////////////////////////////

    broadcastMessage(data: string | Uint8Array, src: PoolMessageSourceInfo, dests: PoolMessageDestinationInfo[] | undefined, fromNodeID: string, partnerIntPath: number | null = null) {
        let panelNumber = this.getPanelNumber();
        let sent = false;
        let restrictToOwnPanel = partnerIntPath != null && src.nodeID != this.nodeID && partnerIntPath != this.nodePosition.PartnerInt;
        let srcPath = this.activeNodes.get(src.nodeID);
        if (!srcPath) srcPath = src.path;

        //if (typeof data == 'string') console.log("MSG SEND", data);
        // console.log("DC SEND")

        if (dests) {
            for (let i = 0; i < 3; i++) {
                let nodeID = this.nodePosition.ParentClusterNodeIDs[panelNumber][i];
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
                        let nodeID = this.nodePosition.ParentClusterNodeIDs[i][j];
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
                                    this.nodePosition.ParentClusterNodeIDs[panelNumber][partnerIntPath] == ""
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

                let destPath = this.activeNodes.get(dests[destIndex].nodeID);
                if (!destPath) continue;

                let matches = 0;
                if (this.nodePosition.Path.length <= destPath.length) {
                    for (let i = 0; i < this.nodePosition.Path.length; i++) {
                        if (this.nodePosition.Path[i] == destPath[i]) {
                            matches++;
                        } else {
                            matches = 0;
                            break;
                        }
                    }
                }

                if (matches == 0) {
                    if (this.nodePosition.CenterCluster) {
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

            if (direction == MessageDirection.CHILD || direction == MessageDirection.BOTH) {  
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
                let nodeID = this.nodePosition.ParentClusterNodeIDs[panelNumber][i];
                if (i != this.nodePosition.PartnerInt && nodeID != "") {
                    if (
                        nodeID != fromNodeID && 
                        (
                            partnerIntPath == null || 
                            this.nodePosition.PartnerInt == partnerIntPath || 
                            partnerIntPath == i || 
                            this.nodePosition.ParentClusterNodeIDs[panelNumber][partnerIntPath] == ""
                        )
                    ) {
                        this.sendDataChannel(nodeID, data);
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
                        if (this.sendToParentClusterPanel(i, data, partnerIntPath)) sent = true;
                    }
                }
            }

            if (direction == MessageDirection.CHILD || direction == MessageDirection.BOTH) {
                for (let i = 0; i < 2; i++) {
                    if (this.sendToChildClusterPanel(i, data, partnerIntPath)) sent = true;
                }
            }
        }
    }
    
    private getDirectionOfMessage(srcPath: number[]): MessageDirection {
        let sendToParent = false;
        let sendToChild = true;
        if (this.nodePosition.Path.length < srcPath.length) {
            for (let i = 0; i < this.nodePosition.Path.length; i++) {
                if (this.nodePosition.Path[i] != srcPath[i]) {
                    sendToParent = false;
                    sendToChild = true;
                    break;
                } else {
                    sendToParent = true;
                    sendToChild = false;
                }
            }
        } else if (this.nodePosition.Path.length == srcPath.length && this.nodePosition.Path.every((v, i) => v == srcPath[i])) {
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

    private setDataChannelFunctions(nodeConnection: NodeConnection, targetNodeID: string, sentOffer: boolean) {
        nodeConnection.dataChannel.binaryType = 'arraybuffer';
        nodeConnection.dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE;
        nodeConnection.dataChannel.onbufferedamountlow = () => {
            //console.log("LOW BUFFER, SENDING QUEUE OF SIZE,", this.DCBufferQueues[nodeConnection.position].length, targetNodeID);
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onopen = () => {
            console.log("DATA CHANNEL WITH", targetNodeID, "OPENED");
            if (!this.latest) {
                //this.sendActiveNodeSignal(targetNodeID);
                this.sendGetLatest(targetNodeID);
            } else if (sentOffer) {
                let isNeighbourNode = false
                for (let i = 0; i < 3; i++) {
                    if (this.nodePosition.ParentClusterNodeIDs[this.getPanelNumber()][i] == targetNodeID) {
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
                let msg: PoolMessagePackage = JSON.parse(e.data);
                if (msg.src.nodeID == this.nodeID) return;
                this.handleMessage(msg, targetNodeID);
            } else {
                // console.log("DC RECV ARRAY BUFFER FROM", targetNodeID);
                this.handleBinaryMessage(e.data as ArrayBuffer, targetNodeID);
            }
        }

        nodeConnection.dataChannel.onclose = (e) => {
            SendSSMessage(this.ws, 2006, { ReportCode: SSReportCodes.DISCONNECT_REPORT } as SSReportNodeData, undefined, targetNodeID);
            let dataChannelBufferQueue = this.DCBufferQueues[nodeConnection.position];
            for (let i = 0; i < dataChannelBufferQueue.length; i++) {
                if (this.reconnect) {
                    // check if nodePosition has a node that is supposed to be there -> do nothing (else empty buffer queue)
                    // every updateNodePosition should update each bufferQueue if empty
                    // Think about whether emit/bufferObject is needed? Is there another way to manage buffers (like global "bufferOverloading paramater")
                    // Keep track of total buffer (add buffer and remove buffer should be controlled)
                    let replacedNodeID: string | undefined = this.getNodeFromPosition(nodeConnection.position);
                    if (replacedNodeID && replacedNodeID != "" && replacedNodeID != targetNodeID) {
                        let replacedNodeConnection = this.nodeConnections.get(replacedNodeID);
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
            if (this.sendDataChannel(this.nodePosition.ParentClusterNodeIDs[panelNumber][partnerIntPath], data)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.ParentClusterNodeIDs[panelNumber][i], data)) sent = true;
            if (partnerIntPath != null && sent) {
                return true;
            }
        }
        return sent;
    }

    private sendToChildClusterPanel(panelNumber: number, data: string | Uint8Array, partnerIntPath: number | null = null): boolean {
        let sent = false;
        if (partnerIntPath != null) {
            if (this.sendDataChannel(this.nodePosition.ChildClusterNodeIDs[panelNumber][partnerIntPath], data)) return true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.sendDataChannel(this.nodePosition.ChildClusterNodeIDs[panelNumber][i], data)) sent = true;
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
                if (this.nodePosition.ParentClusterNodeIDs[i][j] == nodeID) {
                    return position;
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ChildClusterNodeIDs[i][j] == nodeID) {
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
            nodeID = this.nodePosition.ParentClusterNodeIDs[Math.floor(position/3)][position % 3];
        } else {
            position -= 9;
            nodeID = this.nodePosition.ChildClusterNodeIDs[Math.floor(position/3)][position % 3];
        }
        if (nodeID == "") {
            return undefined;
        }
        return nodeID;
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
                if (this.nodePosition.ParentClusterNodeIDs[i][j] == "") {
                    this.curDCBufferQueueLength -= this.DCBufferQueues[position].length;
                    this.DCBufferQueues[position] = [];
                }
                position++;
            }
        }
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.nodePosition.ChildClusterNodeIDs[i][j] == "") {
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
        //console.log("ADDING MESSAGE", message);
        // let copyMessage: PoolMessage = {
        //     msgID: message.msgID,
        //     type: message.type,
        //     userID: message.userID,
        //     created: message.created,
        //     data: message.data,
        //     received: Date.now(),
        // };
        message.received = Date.now();
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
                let isPersistent = this.handlePersistentMessages(message);
                if (!isPersistent) {
                    this.addMessage(message);
                }

                // if (messages[i].type == PoolMessageType.NODE_STATUS) {
                //     if (messages[i].data.state == PoolNodeState.ACTIVE) {
                //         this.addActiveNodeMessage(messages[i]);
                //     } else if (messages[i].data.state == PoolNodeState.INACTIVE) {
                //         this.removeActiveNodeMessage(messages[i]);
                //     }
                // } else {
                //     this.addMessage(messages[i]);
                // }
            }
        }
    }

    private createNodeStateMsgID(nodeID: string, timestamp: number, state: PoolNodeState): string {
        return nodeID + timestamp + state.toString();
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
        };
    }

    private getDests(destNodeIDs: string[] | string): PoolMessageDestinationInfo[] {
        if (typeof destNodeIDs == 'string') {
            destNodeIDs = [destNodeIDs];
        }
        let dests: PoolMessageDestinationInfo[] = [];
        for (let i = 0; i < destNodeIDs.length; i++) {
            let dest: PoolMessageDestinationInfo = {
                nodeID: destNodeIDs[i],
                visited: false,
            };
            dests.push(dest);
        }
        return dests;
    }

    private createMessage(type: PoolMessageType, data?: any, msgID: string = nanoid(MESSAGE_ID_LENGTH)) {
        let msg: PoolMessage = {
            msgID,
            type,
            created: Date.now(),
            userID: getStoreState().profile.userID,
            data,
        }
        return msg;
    }

    private createMessagePackage(type: PoolMessageType, action: PoolMessageAction, data?: any, destNodeIDs?: string[] | string, partnerIntPath: number | null = null): PoolMessagePackage {
        let src = this.getSrc();
        let dests = destNodeIDs ? this.getDests(destNodeIDs) : undefined;
        let messagePackage: PoolMessagePackage = {
            src,
            dests,
            action,
            partnerIntPath,
            msg: this.createMessage(type, data),
        }
        return messagePackage;
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