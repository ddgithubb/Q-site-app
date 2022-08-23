import { SSNodeStatusData, SSReportCodes, SSReportNodeData, SSSDPData, SSStatus, SSMessage, SSDisconnectData } from "./sync-server.model";
import { PoolNodeState, Pool, PoolUpdateLatestInfo, PoolMessage, PoolMessageType, PoolNode, PoolMessageAction, PoolFileInfo, PoolUpdateNodeState, PoolFileRequest, PoolMessageSourceInfo, PoolMessageDestinationInfo, MESSAGE_ID_LENGTH, FILE_ID_LENGTH, PoolMessageInfo, PoolChunkRange } from "./pool.model";
import { getStoreState, store } from "../store/store";
import { AddActiveNodeAction, AddMessageAction, poolAction, RemoveActiveNodeAction, UpdateLatestAction } from "../store/slices/pool.slice";
import { DEFAULT_RECV_MESSAGES_CACHE, MAXIMUM_GET_LATEST_MESSAGE_LENGTH } from "../config/caching";
import { nanoid } from "nanoid";
import { createBinaryMessage, parseBinaryMessage } from "./pool-binary-message";
import { FileManager, PoolManager } from "./global";
import { SendSSMessage } from "./sync-server-client";
import { compactChunkRanges, getCacheChunkNumber } from "./pool-chunks";
import { CacheChunkMapData, CACHE_CHUNK_SIZE, CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CHUNK_SIZE } from "./pool-file-manager";
import { mebibytesToBytes } from "../helpers/file-size";
import EventEmitter from "events";

const MAXIMUM_DC_BUFFER_SIZE = mebibytesToBytes(15);

interface BasicNode {
    NodeID: string;
    UserID: string;
}

interface DataChannelBufferObject {
    msgID: string;
    data: Uint8Array;
    emitSent: boolean;
    inQueue: boolean;
    dest?: PoolMessageDestinationInfo
}

interface NodeConnection {
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    dataChannelBufferQueue: DataChannelBufferObject[];
}

interface NodePosition {
    Path: number[];
    PartnerInt: number;
    CenterCluster: boolean;
    ParentClusterNodes: BasicNode[][];
    ChildClusterNodes: BasicNode[][];
}

export class PoolClient {
    poolID: string;
    poolKey: number;
    ws: WebSocket;
    nodeID: string;
    nodePosition: NodePosition;
    nodeConnections: Map<string, NodeConnection>;
    receivedMessages: PoolMessageInfo[];
    activeNodes: Map<string, number[]>; // key: nodeID, value: lastSeenPath;
    availableFiles: Map<string, number>; // key: fileID, value: totalSize
    curFileRequests: Map<string, PoolFileRequest>;
    dataChannelBufferQueueEventEmitter: EventEmitter; 
    reconnect: boolean;
    new: boolean;
    latest: boolean

    constructor(poolID: string, poolKey: number, ws: WebSocket) {
        this.poolID = poolID;
        this.poolKey = poolKey;
        this.ws = ws;
        this.nodeID = "";
        this.nodePosition = {} as NodePosition;
        this.nodeConnections = new Map<string, NodeConnection>();
        this.receivedMessages = [];
        this.activeNodes = new Map<string, number[]>;
        this.availableFiles = new Map<string, number>;
        this.curFileRequests = new Map<string, PoolFileRequest>;
        this.dataChannelBufferQueueEventEmitter = new EventEmitter();
        this.reconnect = true;
        this.new = true;
        this.latest = false;
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
            fileRequest.cancelled = true;
        })
        this.nodeConnections.clear();
        this.availableFiles.clear();
        this.curFileRequests.clear();
    }

    ////////////////////////////////////////////////////////////////
    // Node setup functions
    ////////////////////////////////////////////////////////////////

    updateNodePosition(nodePosition: NodePosition, myNodeID: string) {
        this.nodePosition = nodePosition;
        this.nodeID = myNodeID;
        console.log(this.nodePosition);
        if (this.new) {
            let profileState = getStoreState().profile;
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
                    fileOffers: [],
                } as PoolNode,
            } as AddActiveNodeAction));
            console.log("NodeID", this.nodeID)
            this.new = false;
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
    
        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);

        let nodeConnection: NodeConnection = {
            connection: connection,
            dataChannel: dataChannel,
            dataChannelBufferQueue: [],
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
    
        let connection = initializeRTCPeerConnection();
        let dataChannel = initializeMainDataChannel(connection);

        let nodeConnection: NodeConnection = {
            connection: connection,
            dataChannel: dataChannel,
            dataChannelBufferQueue: [],
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
        this.handleMessage(this.createMessage(PoolMessageType.SIGNAL_STATUS, PoolMessageAction.DEFAULT, {
            nodeID: nodeID,
            state: PoolNodeState.INACTIVE,
        } as PoolUpdateNodeState));
    }

    sendGetLatest(nodeID: string, initialLatest: boolean = false) {
        let pool = this.getPool();
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, PoolMessageAction.REQUEST, {
            messagesOnly: initialLatest ? false : pool.activeNodes.length != 0 ? false : true,
            lastMessageID: pool.messages.length > 0 ? pool.messages[pool.messages.length - 1].msgID : "",
        } as PoolUpdateLatestInfo, nodeID)));
    }

    sendRespondGetLatest(nodeID: string, messagesOnly: boolean, lastMessageID: string) {
        let pool = this.getPool();
        let correctedActiveNodes: PoolNode[] = [];
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
            latest.messages = i == -1 ? pool.messages : pool.messages.slice(i + 1)
        }
        //console.log(correctedActiveNodes);
        this.sendDataChannel(nodeID, JSON.stringify(this.createMessage(PoolMessageType.GET_LATEST, PoolMessageAction.REPLY, latest, nodeID)))
    }

    sendTextMessage(text: string) {
        this.handleMessage(this.createMessage(PoolMessageType.TEXT, PoolMessageAction.DEFAULT, text))
    }

    sendFileOffer(file: File) {
        let fileID: string = nanoid(FILE_ID_LENGTH);
        if (!FileManager.addFileOffer(this.poolID, fileID, file)) return;
        this.handleMessage(this.createMessage(PoolMessageType.FILE, PoolMessageAction.DEFAULT, {
            fileID: fileID,
            nodeID: this.nodeID,
            fileName: file.name,
            totalSize: file.size,
        } as PoolFileInfo))
    }

    async sendRequestFile(poolFileInfo: PoolFileInfo, chunksMissing: PoolChunkRange[] = []) {
        if (poolFileInfo.nodeID == this.nodeID) return;
        if (chunksMissing.length == 0) {
            if (!(await FileManager.addFileDownload(this.poolID, poolFileInfo))) return;
        }
        if (chunksMissing.length == 0) {
            for (let i = 0; i < 3; i++) {
                this.handleMessage(this.createMessage(PoolMessageType.FILE, PoolMessageAction.REQUEST, {
                    fileID: poolFileInfo.fileID,
                    requestFromOrigin: false,
                    chunksMissing: [],
                    cacheChunksCovered: [],
                } as PoolFileRequest, poolFileInfo.nodeID, i));
            }
        } else {
            this.handleMessage(this.createMessage(PoolMessageType.FILE, PoolMessageAction.REQUEST, {
                fileID: poolFileInfo.fileID,
                requestFromOrigin: true,
                chunksMissing: chunksMissing,
                cacheChunksCovered: [],
            } as PoolFileRequest, poolFileInfo.nodeID));
        }

    }

    sendChunk(fileID: string, chunkNumber: number, chunk: ArrayBuffer, dest: PoolMessageDestinationInfo, partnerIntPath: number, nextChunk?: () => any) {
        if (!this.reconnect || !this.activeNodes.has(dest.nodeID)) return;
        let src: PoolMessageSourceInfo = {
            nodeID: this.nodeID,
            path: this.nodePosition.Path,
        };
        // console.log("sending chunk", chunkNumber);
        let msgID = nanoid(MESSAGE_ID_LENGTH);
        let dcBuffer: DataChannelBufferObject = {
            msgID: msgID,
            data: createBinaryMessage(chunk, msgID, fileID, chunkNumber, src, dest),
            emitSent: true,
            inQueue: false,
            dest: dest,
        };
        this.broadcastMessage(dcBuffer, src, dest, partnerIntPath);
        if (dcBuffer.inQueue) {
            this.dataChannelBufferQueueEventEmitter.once(msgID, (closed: boolean) => {
                if (!closed) {
                    //console.log("FINALLY SENDING CHUNK", chunkNumber);
                    if (nextChunk) nextChunk();
                }
            })
        } else {
            if (nextChunk) nextChunk();
        }
    }

    sendFile(srcNodeID: string, fileRequest: PoolFileRequest) {
        let poolFileOffers = FileManager.fileOffers.get(this.poolID);
        if (!poolFileOffers) return;
        let fileOffer = poolFileOffers.get(fileRequest.fileID);
        if (!fileOffer) return;
        if (srcNodeID != this.nodeID && !this.activeNodes.has(srcNodeID)) return;

        let existingFileRequest = this.curFileRequests.get(fileRequest.fileID); // THIS ONLY WORKS FOR 1 CONCURRENT UPLOAD (SO ADD CONCURRENT UPLOAD FEATURE)
        if (!existingFileRequest) {
            existingFileRequest = fileRequest;
            existingFileRequest.cacheChunksSet = new Set<number>(fileRequest.cacheChunksCovered);
            this.curFileRequests.set(fileRequest.fileID, existingFileRequest);
        } else {
            for (let i = 0; i < fileRequest.cacheChunksCovered.length; i++) {
                existingFileRequest.cacheChunksSet!.add(fileRequest.cacheChunksCovered[i]);
            }
            return;
        }

        //fileRequest.cancelled = true;

        // ONE WAY to do cocurrent upload is to calculate the chunks needed before hand? (that doesn't work because of cacehChunksSet updating)
        // Need global chunksMissing, can't really use range because it can add up
            // Maybe needs map?

        if (fileRequest.requestFromOrigin) {
            fileRequest.cacheChunksCovered = [];
        } else if (fileRequest.chunksMissing.length != 0) {
            compactChunkRanges(fileRequest.chunksMissing);
        }

        let chunkNumber = 0;
        let chunksMissingRangeNumber = 0;
        let partnerIntPath = 0;
        let dest = this.getDest(srcNodeID);

        let fileReader = new FileReader();
        fileReader.onload = (e) => {
            if (!e.target) return;
            if (fileOffer?.retracted || fileRequest.cancelled) return;
            partnerIntPath = getCacheChunkNumber(chunkNumber) % 3;
            this.sendChunk(fileRequest.fileID, chunkNumber++, e.target.result as ArrayBuffer, dest, partnerIntPath, nextChunk);
        }

        let nextChunk = () => {
            if (fileRequest.chunksMissing.length != 0) {
                if (chunkNumber < fileRequest.chunksMissing[chunksMissingRangeNumber][0]) {
                    chunkNumber = fileRequest.chunksMissing[chunksMissingRangeNumber][0];
                } else if (chunkNumber > fileRequest.chunksMissing[chunksMissingRangeNumber][1]) {
                    do {
                        chunksMissingRangeNumber++;
                        if (chunksMissingRangeNumber >= fileRequest.chunksMissing.length) {
                            this.curFileRequests.delete(fileRequest.fileID);
                            return;
                        }
                    } while (chunkNumber > fileRequest.chunksMissing[chunksMissingRangeNumber][1]);
                    chunkNumber = fileRequest.chunksMissing[chunksMissingRangeNumber][0];
                }
            } else {
                let cacheNumber = getCacheChunkNumber(chunkNumber);
                if (fileRequest.cacheChunksSet!.has(cacheNumber)) {
                    chunkNumber += CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR;
                    nextChunk();
                    return;
                }
            }
            
            let offset = chunkNumber * CHUNK_SIZE;
            if (offset >= fileOffer!.file.size) {
                this.curFileRequests.delete(fileRequest.fileID);
                return;
            }
            fileReader.readAsArrayBuffer(fileOffer!.file.slice(offset, offset + CHUNK_SIZE))
        }

        console.log("SENDING FILE");
        nextChunk();
    }

    sendCacheChunks(fileID: string, destNodeID: string, cacheChunkMapData: CacheChunkMapData) {
        let dest = this.getDest(destNodeID);

        let i = 0;
        let nextCacheChunk = async () => {
            if (i >= cacheChunkMapData.length) return;
            if (!this.reconnect || !this.activeNodes.has(destNodeID)) return;
            let cacheChunk = await FileManager.getCacheChunk(cacheChunkMapData[i].key);
            let j = 0;
            let chunkNumber = 0;
            if (!cacheChunk) {
                // POSSIBLE TO SEND REQUEST FOR THESE CHUNKS ON BEHALF?
                // console.log("NO CACHECHUNK");
                i++;
                nextCacheChunk();
                return;
            } else {
                //console.log("SENDING CACHECHUNK NUMBER", i);
            }
            let nextChunk = () => {
                if (j >= cacheChunk.length) {
                    i++;
                    nextCacheChunk();
                    return;
                }
                chunkNumber = (cacheChunkMapData[i].cacheChunkNumber * CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR) + j;
                if (destNodeID != this.nodeID) {
                    this.sendChunk(fileID, chunkNumber, cacheChunk[j++], dest, this.nodePosition.PartnerInt, nextChunk);
                } else {
                    FileManager.addFileChunk(fileID, chunkNumber, cacheChunk[j++]);
                    nextChunk();
                }
            }
            nextChunk();
        }

        nextCacheChunk();
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage helper functions
    ////////////////////////////////////////////////////////////////

    updateLatest(updateLatestInfo: PoolUpdateLatestInfo) {
        if (!updateLatestInfo.messagesOnly) {
            this.activeNodes.clear();
            this.availableFiles.clear();
        }
        for (let i = 0; i < updateLatestInfo.activeNodes.length; i++) {
            this.activeNodes.set(updateLatestInfo.activeNodes[i].nodeID, updateLatestInfo.activeNodes[i].lastSeenPath);
            for (let j = 0; j < updateLatestInfo.activeNodes[i].fileOffers.length; j++) {
                this.availableFiles.set(updateLatestInfo.activeNodes[i].fileOffers[j].fileID, updateLatestInfo.activeNodes[i].fileOffers[j].totalSize);
            }
        }
        store.dispatch(poolAction.updateLatest({
            key: this.poolKey,
            latest: updateLatestInfo,
        } as UpdateLatestAction));
        this.latest = true;
    }

    addActiveNode(node: PoolNode) {
        // console.log("ADDING ACTIVE NODE");
        if (node.nodeID != this.nodeID) {
            this.activeNodes.set(node.nodeID, node.lastSeenPath);
            store.dispatch(poolAction.addActiveNode({
                key: this.poolKey,
                node: node,
            } as AddActiveNodeAction));
        }
    }

    removeActiveNode(nodeID: string) {
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
                this.availableFiles.delete(existingNode.fileOffers[i].fileID);
                FileManager.completeFileDownload(existingNode.fileOffers[i].fileID);
            }
        }
        store.dispatch(poolAction.removeActiveNode({
            key: this.poolKey,
            nodeID: nodeID,
        } as RemoveActiveNodeAction));
    }

    addAndSendChunksCovered(srcNodeID: string, request: PoolFileRequest, partnerIntPath: number) {
        // PROBLEM, should check if chunkCovered is already covered...
        // Also for the chunks actually not covered, send
        if (!request.requestFromOrigin) {
            if (partnerIntPath == this.nodePosition.PartnerInt || srcNodeID == this.nodeID) {
                let cacheChunkMapData = FileManager.cacheChunkMap.get(request.fileID);
                if (cacheChunkMapData) {
                    let cacheChunks = new Set<number>(request.cacheChunksCovered);
                    let sendCacheChunkMapData: CacheChunkMapData = [];
                    for (let i = 0; i < cacheChunkMapData.length; i++) {
                        if (cacheChunkMapData[i].cacheChunkNumber % 3 == partnerIntPath && !cacheChunks.has(cacheChunkMapData[i].cacheChunkNumber)) {
                            request.cacheChunksCovered.push(cacheChunkMapData[i].cacheChunkNumber);
                            sendCacheChunkMapData.push(cacheChunkMapData[i])
                        }
                    }
                    this.sendCacheChunks(request.fileID, srcNodeID, sendCacheChunkMapData);
                }
            }
        } 
        // Problme 5, In a cluster with only the parent cluster, check that caching doesn't overlap with original node sending everything (shouldn't exist)
            // Deeper problme is if One panel is full, and the other panel has 2 nodes, and your destination node is not connected, what happens when sending to sourceNode partnerIntPath?
                // There needs to be rerouting strategies
                    // SHOULD WORK NOW, CHECK TO MAKE SURE
    }

    ////////////////////////////////////////////////////////////////
    // HandleMessage functions
    ////////////////////////////////////////////////////////////////

    handleMessage(msg?: PoolMessage) {
        if (!msg) return;

        let pool = this.getPool();
        if (this.checkMessageDuplicate(msg.msgID, msg.created)) return;

        console.log("MSG RECV:", JSON.stringify(msg));

        if (msg.src.nodeID != this.nodeID) {
            if (this.activeNodes.has(msg.src.nodeID)) {
                this.activeNodes.set(msg.src.nodeID, msg.src.path);
            }
        }

        if (msg.dest) {
            if (msg.dest.nodeID == this.nodeID) {
                switch (msg.type) {
                case PoolMessageType.GET_LATEST:
                    if (msg.action == PoolMessageAction.REQUEST) {
                        this.sendRespondGetLatest(msg.src.nodeID, msg.data.messagesOnly, msg.data.lastMessageID);
                    } else if (msg.action == PoolMessageAction.REPLY) {
                        this.updateLatest(msg.data);
                    }
                    break;
                case PoolMessageType.FILE:
                    if (msg.action == PoolMessageAction.REQUEST) {
                        this.sendFile(msg.src.nodeID, msg.data);
                    }
                    break;
                }
                return
            }

            if (msg.dest.lastSeenPath.length == 0) return;

            switch (msg.type) {
            case PoolMessageType.GET_LATEST:
                break;
            case PoolMessageType.FILE:
                if (msg.action == PoolMessageAction.REQUEST) {
                    if (msg.partnerIntPath != null) {
                        this.addAndSendChunksCovered(msg.src.nodeID, msg.data, msg.partnerIntPath);
                    }
                }
                break;
            default:
                return
            }
        } else {
            switch (msg.type) {
            case PoolMessageType.SIGNAL_STATUS:
                let existingNodeID: boolean = this.activeNodes.has(msg.data.nodeID);
                if (msg.data.state == PoolNodeState.ACTIVE && !existingNodeID) {
                    this.addActiveNode(msg.data);
                } else if (msg.data.state == PoolNodeState.INACTIVE && existingNodeID && !this.nodeConnections.get(msg.data.nodeID)) {
                    this.removeActiveNode(msg.data.nodeID);
                } else {
                    return
                }
                break;
            case PoolMessageType.TEXT:
                if (msg.data == "" || msg.data.length >= pool.PoolSettings.maxTextLength || msg.data.replaceAll(" ", "").replaceAll("&nbsp;", "").replaceAll("<br>", "") == "") {
                    return
                }
                store.dispatch(poolAction.addMessage({
                    key: this.poolKey,
                    message: msg,
                } as AddMessageAction));
                break;
            case PoolMessageType.FILE:
                this.availableFiles.set(msg.data.fileID, msg.data.totalSize);
                store.dispatch(poolAction.addMessage({
                    key: this.poolKey,
                    message: msg,
                } as AddMessageAction));
                break;
            default:
                return
            }
        }
        
        let data = JSON.stringify(msg);
        this.broadcastMessage(data, msg.src, msg.dest, msg.partnerIntPath);
    }

    async handleBinaryMessage(binaryData: ArrayBuffer) {
        let data = new Uint8Array(binaryData);

        let parsedMsg = parseBinaryMessage(data)
        if (!parsedMsg) return; //report

        let [ payload, msgID, fileID, chunkNumber, src, dest ] = parsedMsg;

        if (payload.byteLength == 0) return;
        let fileSize = this.availableFiles.get(fileID);
        if (!fileSize) return;


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
        // 1 step/15mb buffer: 39,813ms
        // 3 steps/15mb buffer/1mb cache chunk: 101,662ms

        // CACHING WITH EXISTING CACHE:
        // 3 steps/15mb buffer/1mb cache chunk: 101,781ms (not much difference)

        // Figure out best config for caching, becuase you have 3 different paths
            // 3 different messages (different msgID), indicating a certain path (it will work itself out)

        //console.log("BINARY MSG RECV:", payload.length, msgID, fileID, chunkNumber, src, dest);

        if (dest) {
            if (getCacheChunkNumber(chunkNumber) % 3 == this.nodePosition.PartnerInt) {
                FileManager.cacheFileChunk(fileID, chunkNumber, fileSize, payload)
            }
            if (dest.nodeID == this.nodeID) {
                FileManager.addFileChunk(fileID, chunkNumber, payload);
                return;
            }

            this.broadcastMessage({
                msgID: msgID,
                data: data,
                emitSent: false,
                dest: dest,
            } as DataChannelBufferObject, src, dest, this.nodePosition.PartnerInt);
        } else {
            return; // remove when this is populated
        }
    }

    ////////////////////////////////////////////////////////////////
    // Data channel functions
    ////////////////////////////////////////////////////////////////

    broadcastMessage(data: string | DataChannelBufferObject, src: PoolMessageSourceInfo, dest?: PoolMessageDestinationInfo, partnerIntPath: number | null = null): boolean {
        let panelNumber = this.getPanelNumber();

        // if (typeof data == 'string') console.log("MSG SEND", data);
        // console.log("DC SEND")
        if (dest) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let nodeID = this.nodePosition.ParentClusterNodes[i][j].NodeID;
                    if (nodeID != "" && nodeID != this.nodeID && nodeID == dest.nodeID) {
                        if (this.sendDataChannel(nodeID, data)) {
                            // console.log("SENDING TO NODEID", nodeID)
                            return true;
                        } else if (i == panelNumber) {
                            return false;
                        }
                        break;
                    }
                }
            }
        }

        let sent = false;

        for (let i = 0; i < 3; i++) {
            if (i != this.nodePosition.PartnerInt) {
                if (partnerIntPath == null || i == partnerIntPath) {
                    if (this.sendDataChannel(this.nodePosition.ParentClusterNodes[panelNumber][i].NodeID, data)) sent = true;
                }
            }
        }
        
        if (partnerIntPath != null && sent) return true;

        // console.log("Sending to", partnerIntPath)
        
        if (dest) {
            let matches = 0;
            let srcDestMatches = 0;
            if (this.nodePosition.Path.length <= dest.lastSeenPath.length) {
                for (let i = 0; i < this.nodePosition.Path.length; i++) {
                    if (this.nodePosition.Path[i] == dest.lastSeenPath[i]) {
                        matches++;
                    } else {
                        matches = 0;
                        break;
                    }
                }
                if (matches != 0) {
                    for (let i = 0; i < Math.min(src.path.length, dest.lastSeenPath.length); i++) {
                        if (src.path[i] == dest.lastSeenPath[i]) {
                            srcDestMatches++;
                        } else {
                            break;
                        }
                    }
                }
            }
            if (matches == 0) {
                if (this.nodePosition.CenterCluster) {
                    if (this.sendToParentClusterPanel(dest.lastSeenPath[0], data, partnerIntPath)) sent = true;
                } else {
                    if (this.sendToParentClusterPanel(2, data, partnerIntPath)) sent = true;
                }
            } else {
                if (matches != 1 && matches <= srcDestMatches) {
                    if (this.sendToParentClusterPanel(2, data, partnerIntPath)) sent = true;
                }
                if (matches != dest.lastSeenPath.length && matches >= srcDestMatches) {
                    if (this.sendToChildClusterPanel(dest.lastSeenPath[matches], data, partnerIntPath)) sent = true;
                }
            } 
        } else {
            let sendDown = true;
            let sendUp = false;
            if (this.nodePosition.Path.length < src.path.length) {
                for (let i = 0; i < this.nodePosition.Path.length; i++) {
                    if (this.nodePosition.Path[i] != src.path[i]) {
                        sendDown = true;
                        sendUp = false;
                        break;
                    } else {
                        sendDown = false;
                        sendUp = true;
                    }
                }
            } else if (this.nodePosition.Path.length == src.path.length && this.nodePosition.Path.every((v, i) => v == src.path[i])) {
                sendDown = true;
                sendUp = true;
            }

            if (sendDown) {
                for (let i = 0; i < 2; i++) {
                    if (this.sendToChildClusterPanel(i, data)) sent = true;
                }
            } 
            if (sendUp) {
                for (let i = 0; i < 3; i++) {
                    if (i != panelNumber) {
                        if (this.sendToParentClusterPanel(i, data)) sent = true;
                    }
                }
            }
        }

        return sent;
    }

    private setDataChannelFunctions(nodeConnection: NodeConnection, targetNodeID: string, sentOffer: boolean) {
        nodeConnection.dataChannel.binaryType = 'arraybuffer';
        nodeConnection.dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE;
        nodeConnection.dataChannel.onbufferedamountlow = () => {
            // console.log("LOW BUFFER, SENDING QUEUE OF SIZE,", nodeConnection.dataChannelBufferQueue.length, targetNodeID);
            this.flushDCBufferQueue(nodeConnection);
        }

        nodeConnection.dataChannel.onopen = () => {
            console.log("DATA CHANNEL WITH", targetNodeID, "OPENED");
            this.sendActiveNodeSignal(targetNodeID);
            if (!this.latest) {
                this.sendGetLatest(targetNodeID, true);
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
                this.handleMessage(msg);
            } else {
                //console.log("DC RECV ARRAY BUFFER FROM", targetNodeID);
                this.handleBinaryMessage(e.data as ArrayBuffer);
            }
        }

        nodeConnection.dataChannel.onclose = (e) => {
            SendSSMessage(this.ws, 2006, { ReportCode: SSReportCodes.DISCONNECT_REPORT } as SSReportNodeData, undefined, targetNodeID);
            let src: PoolMessageSourceInfo = {
                nodeID: this.nodeID,
                path: this.nodePosition.Path,
            }
            for (let i = 0; i < nodeConnection.dataChannelBufferQueue.length; i++) {
                if (!this.reconnect && nodeConnection.dataChannelBufferQueue[i].emitSent) {
                    this.dataChannelBufferQueueEventEmitter.emit(nodeConnection.dataChannelBufferQueue[i].msgID, true);
                } else {
                    this.broadcastMessage(nodeConnection.dataChannelBufferQueue[i], src, nodeConnection.dataChannelBufferQueue[i].dest, this.nodePosition.PartnerInt);
                }
            }
        }
    }

    private sendDataChannel(nodeID: string, data: string | DataChannelBufferObject): boolean {
        if (nodeID == "") return false;
        let nc = this.nodeConnections.get(nodeID);
        if (!nc) return false;
        if (nc.dataChannel.readyState == 'open') {
            //console.log("DC SEND", nodeID, typeof data == 'string' ? data : "ARRAY BUFFER");
            if (typeof data != 'string') {
                if (nc.dataChannel.bufferedAmount >= MAXIMUM_DC_BUFFER_SIZE) {
                    //console.log("BUFFER SIZE", nc.dataChannel.bufferedAmount, MAXIMUM_DC_BUFFER_SIZE);
                    nc.dataChannelBufferQueue.push(data);
                    data.inQueue = true;
                    return true;
                }
                //console.log("DC SEND BUFFER")
                nc.dataChannel.send(data.data);
            } else {
                nc.dataChannel.send(data);
            }
            return true;
        } else {
            if (typeof data != 'string') {
                //console.log("PUSHING BEFORE DC OPEN")
                nc.dataChannelBufferQueue.push(data);
                return true
            }
        }
        return false;
    }

    private sendToParentClusterPanel(panelNumber: number, data: string | DataChannelBufferObject, partnerIntPath: number | null = null): boolean {
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

    private sendToChildClusterPanel(panelNumber: number, data: string | DataChannelBufferObject, partnerIntPath: number | null = null): boolean {
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

    private flushDCBufferQueue(nodeConnection: NodeConnection) {
        let i = 0
        for (; i < nodeConnection.dataChannelBufferQueue.length; i++) {
            if (nodeConnection.dataChannel.bufferedAmount >= MAXIMUM_DC_BUFFER_SIZE) {
                break;
            }
            //console.log(nodeConnection.dataChannelBufferQueue[i].binaryData);
            nodeConnection.dataChannel.send(nodeConnection.dataChannelBufferQueue[i].data);
            if (nodeConnection.dataChannelBufferQueue[i].emitSent) {
                this.dataChannelBufferQueueEventEmitter.emit(nodeConnection.dataChannelBufferQueue[i].msgID, false);
            }
        }
        nodeConnection.dataChannelBufferQueue.splice(0, i);
    }

    ////////////////////////////////////////////////////////////////
    // PoolMessage helpers functions
    ////////////////////////////////////////////////////////////////

    private checkMessageDuplicate(msgID: string, created?: number): boolean {
        let poolMessageExists: boolean = false;
        for (let i = this.receivedMessages.length - 1; i >= 0; i--) {
            if (created && this.receivedMessages[i].received < created) {
                break
            } else {
                if (this.receivedMessages[i].msgID == msgID) {
                    poolMessageExists = true;
                }
            }
        }
        if (poolMessageExists) return true

        this.receivedMessages.push({
            msgID: msgID,
            received: Date.now(),
        });
        if (this.receivedMessages.length > DEFAULT_RECV_MESSAGES_CACHE) {
            this.receivedMessages.shift();
        }

        return false;
    }

    private getSrc(): PoolMessageSourceInfo {
        return {
            nodeID: this.nodeID,
            path: this.nodePosition.Path,
        }
    }

    private getDest(destNodeID: string): PoolMessageDestinationInfo {
        let lsp = this.activeNodes.get(destNodeID);
        return {
            nodeID: destNodeID,
            lastSeenPath: lsp || [],
        }
    }

    private createMessage(type: PoolMessageType, action: PoolMessageAction, data?: any, destNodeID?: string, partnerIntPath: number | null = null): PoolMessage | undefined {
        let src = this.getSrc();
        let dest = destNodeID ? this.getDest(destNodeID) : undefined;
        return {
            src: src,
            dest: dest,
            type: type,
            action: action,
            msgID: nanoid(MESSAGE_ID_LENGTH),
            created: Date.now(),
            userID: getStoreState().profile.userID,
            data: data,
            partnerIntPath: partnerIntPath,
        } as PoolMessage;
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