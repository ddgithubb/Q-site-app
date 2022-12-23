import { nanoid } from "nanoid";
import { FILE_ID_LENGTH, MESSAGE_ID_LENGTH, NODE_ID_LENGTH, PoolMessageDestinationInfo, PoolMessageSourceInfo } from "./pool.model";

var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();

const BOOLEAN_LENGTH = 1;
const INDICATOR_LENGTH = 1;
const FILE_SIZE_BUFFER_LENGTH = 4;

//export type ParsedBinaryMessage = [ArrayBuffer, string, number, PoolMessageSourceInfo, PoolMessageDestinationInfo[] | undefined];

export interface ParsedBinaryMessage {
    payload: ArrayBuffer;
    fileID: string;
    chunkNumber: number;
    src: PoolMessageSourceInfo;
    dests: PoolMessageDestinationInfo[] | undefined;
}

export function createBinaryMessage(payload: ArrayBuffer, fileID: string, chunkNumber: number, src: PoolMessageSourceInfo, dests?: PoolMessageDestinationInfo[]): Uint8Array {
    let length = NODE_ID_LENGTH + src.path.length + INDICATOR_LENGTH + FILE_ID_LENGTH + FILE_SIZE_BUFFER_LENGTH + payload.byteLength;
    if (dests) {
        for (let i = 0; i < dests.length; i++) {
            length += (NODE_ID_LENGTH + BOOLEAN_LENGTH + INDICATOR_LENGTH);
        }
    }
    let data = new Uint8Array(length);
    let offset = 0;

    data.set(textEncoder.encode(src.nodeID), offset);
    offset += NODE_ID_LENGTH;
    data.set(src.path, offset)
    offset += src.path.length;
    data.set([dests ? 254 : 255], offset);
    offset += INDICATOR_LENGTH;

    if (dests) {
        for (let i = 0; i < dests.length; i++) {
            data.set(textEncoder.encode(dests[i].nodeID), offset);
            offset += NODE_ID_LENGTH;
            data.set([dests[i].visited ? 1 : 0], offset);
            offset += BOOLEAN_LENGTH;
            data.set([i != dests.length - 1 ? 254 : 255], offset);
            offset += INDICATOR_LENGTH;
        }
    }

    // data.set(textEncoder.encode(msgID), offset)
    // offset += MESSAGE_ID_LENGTH
    data.set(textEncoder.encode(fileID), offset);
    offset += FILE_ID_LENGTH;
    let chunkNumberBuffer = new ArrayBuffer(FILE_SIZE_BUFFER_LENGTH);
    let chunkNumberDataView = new DataView(chunkNumberBuffer);
    chunkNumberDataView.setUint32(0, chunkNumber, false);
    data.set(new Uint8Array(chunkNumberBuffer), offset);
    offset += FILE_SIZE_BUFFER_LENGTH;
    
    data.set(new Uint8Array(payload), offset);
    return data;
}

export function parseBinaryMessage(data: Uint8Array): ParsedBinaryMessage | undefined {
    let offset = 0;
    let src: PoolMessageSourceInfo = {
        nodeID: "",
        path: [],
    };
    let dests: PoolMessageDestinationInfo[] | undefined = undefined;
    // let msgID: string = "";
    let fileID: string = "";
    let chunkNumber: number;
    let payload: Uint8Array;

    src.nodeID = textDecoder.decode(data.subarray(offset, offset += NODE_ID_LENGTH));
    if (src.nodeID.length != NODE_ID_LENGTH) return undefined;
    while (true) {
        let p = data.at(offset++);
        if (p == undefined) return undefined;
        if (p == 254) {
            dests = [];
            break;
        } else if (p == 255) {
            break;
        }
        if (p != 0 && p != 1 && p != 2) return undefined;
        src.path.push(p);
    }
    if (src.path.length == 0) return undefined;
    // console.log("PARSING BINARY SRC", src);
    if (dests) {
        while (true) {
            let dest: PoolMessageDestinationInfo = {
                nodeID: "",
                visited: false,
            }
            dest.nodeID = textDecoder.decode(data.subarray(offset, offset += NODE_ID_LENGTH));
            if (dest.nodeID.length != NODE_ID_LENGTH) return undefined;
            // console.log("PARSING BINARY PASS", dest.nodeID);
            dest.visited = (data.at(offset++) || 0) == 1;
            dests.push(dest);
            let p = data.at(offset++);
            if (p == 254) {
                continue;
            } else if (p == 255) {
                break;
            }
        }
    }

    // msgID = textDecoder.decode(data.subarray(offset, offset += MESSAGE_ID_LENGTH));
    // if (msgID.length != MESSAGE_ID_LENGTH) return undefined;
    fileID = textDecoder.decode(data.subarray(offset, offset += FILE_ID_LENGTH));
    if (fileID.length != FILE_ID_LENGTH) return undefined;

    let chunkNumberData = data.subarray(offset, offset += 4);
    let chunkNumberDataView = new DataView(chunkNumberData.buffer.slice(chunkNumberData.byteOffset, chunkNumberData.byteLength + chunkNumberData.byteOffset));
    chunkNumber = chunkNumberDataView.getUint32(0, false);

    payload = data.subarray(offset)
    if (payload.length == 0) return undefined;
    return {
        payload: payload.buffer.slice(payload.byteOffset),
        fileID,
        chunkNumber,
        src,
        dests
    };
}

export function setBinaryMessageDestVisited(data: Uint8Array, parsedMsg: ParsedBinaryMessage, targetDestNodeID: string) {
    let offset = NODE_ID_LENGTH + parsedMsg.src.path.length + INDICATOR_LENGTH;
    if (!parsedMsg.dests) return;
    for (let i = 0; i < parsedMsg.dests.length; i++) {
        if (parsedMsg.dests[i].nodeID == targetDestNodeID) {
            offset += NODE_ID_LENGTH;
            data.set([1], offset);
            parsedMsg.dests[i].visited = true;
            return;
        }
        offset += NODE_ID_LENGTH + BOOLEAN_LENGTH + INDICATOR_LENGTH;
    }
}