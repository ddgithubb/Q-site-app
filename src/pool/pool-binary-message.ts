import { nanoid } from "nanoid";
import { FILE_ID_LENGTH, MESSAGE_ID_LENGTH, NODE_ID_LENGTH, PoolMessageDestinationInfo, PoolMessageSourceInfo } from "./pool.model";

var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();

export function createBinaryMessage(payload: ArrayBuffer, msgID: string, fileID: string, chunkNumber: number, src: PoolMessageSourceInfo, dest?: PoolMessageDestinationInfo): Uint8Array {
    let length = NODE_ID_LENGTH + src.path.length + 1 + MESSAGE_ID_LENGTH + FILE_ID_LENGTH + 4 + payload.byteLength;
    length += (dest ? NODE_ID_LENGTH + dest.lastSeenPath.length + 1 : 0);
    let data = new Uint8Array(length);
    let offset = 0;

    data.set(textEncoder.encode(src.nodeID), offset);
    offset += NODE_ID_LENGTH;
    data.set(src.path, offset)
    offset += src.path.length;
    data.set([dest ? 254 : 255], offset);
    offset += 1;

    if (dest) {
        data.set(textEncoder.encode(dest.nodeID), offset);
        offset += dest.nodeID.length;
        data.set(dest.lastSeenPath, offset)
        offset += dest.lastSeenPath.length;
        data.set([255], offset);
        offset += 1;
    }

    data.set(textEncoder.encode(msgID), offset)
    offset += MESSAGE_ID_LENGTH
    data.set(textEncoder.encode(fileID), offset);
    offset += FILE_ID_LENGTH;
    let chunkNumberBuffer = new ArrayBuffer(4);
    let chunkNumberDataView = new DataView(chunkNumberBuffer);
    chunkNumberDataView.setUint32(0, chunkNumber, false);
    data.set(new Uint8Array(chunkNumberBuffer), offset);
    offset += 4;
    
    data.set(new Uint8Array(payload), offset);
    return data;
}

export function parseBinaryMessage(data: Uint8Array): [ArrayBuffer, string, string, number, PoolMessageSourceInfo, PoolMessageDestinationInfo | undefined] | undefined {
    let offset = 0;
    let src: PoolMessageSourceInfo = {
        nodeID: "",
        path: [],
    };
    let dest: PoolMessageDestinationInfo | undefined = undefined;
    let msgID: string = "";
    let fileID: string = "";
    let chunkNumber: number;
    let payload: Uint8Array;

    src.nodeID = textDecoder.decode(data.subarray(offset, offset += NODE_ID_LENGTH));
    if (src.nodeID.length != NODE_ID_LENGTH) return undefined;
    while (true) {
        let p = data.at(offset++);
        if (!p) return undefined;
        if (p == 254) {
            dest = {
                nodeID: "",
                lastSeenPath: [],
            }
            break;
        } else if (p == 255) {
            break;
        }
        if (p != 0 && p != 1 && p != 2) return undefined;
        src.path.push(p);
    }
    if (src.path.length == 0) return undefined;
    if (dest) {
        dest.nodeID = textDecoder.decode(data.subarray(offset, offset += NODE_ID_LENGTH));
        if (dest.nodeID.length != NODE_ID_LENGTH) return undefined;
        while (true) {
            let p = data.at(offset++);
            if (!p) return undefined;
            if (p == 255) {
                break;
            }
            if (p != 0 && p != 1 && p != 2) return undefined;
            dest.lastSeenPath.push(p);
        }
        if (dest.lastSeenPath.length == 0 && src.nodeID != dest.nodeID) return undefined;
    }

    msgID = textDecoder.decode(data.subarray(offset, offset += MESSAGE_ID_LENGTH));
    if (msgID.length != MESSAGE_ID_LENGTH) return undefined;
    fileID = textDecoder.decode(data.subarray(offset, offset += FILE_ID_LENGTH));
    if (fileID.length != FILE_ID_LENGTH) return undefined;

    let chunkNumberData = data.subarray(offset, offset += 4);
    let chunkNumberDataView = new DataView(chunkNumberData.buffer.slice(chunkNumberData.byteOffset, chunkNumberData.byteLength + chunkNumberData.byteOffset));
    chunkNumber = chunkNumberDataView.getUint32(0, false);

    payload = data.subarray(offset)
    if (payload.length == 0) return undefined;
    return [payload.buffer.slice(payload.byteOffset), msgID, fileID, chunkNumber, src, dest];
}