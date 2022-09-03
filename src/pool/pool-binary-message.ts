import { nanoid } from "nanoid";
import { FILE_ID_LENGTH, MESSAGE_ID_LENGTH, NODE_ID_LENGTH, PoolMessageDestinationInfo, PoolMessageSourceInfo } from "./pool.model";

var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();

export function createBinaryMessage(payload: ArrayBuffer, msgID: string, fileID: string, chunkNumber: number, src: PoolMessageSourceInfo, dests?: PoolMessageDestinationInfo[]): Uint8Array {
    let length = NODE_ID_LENGTH + src.path.length + 1 + MESSAGE_ID_LENGTH + FILE_ID_LENGTH + 4 + payload.byteLength;
    if (dests) {
        for (let i = 0; i < dests.length; i++) {
            length += (NODE_ID_LENGTH + dests[i].lastSeenPath.length + 1);
        }
    }
    let data = new Uint8Array(length);
    let offset = 0;

    data.set(textEncoder.encode(src.nodeID), offset);
    offset += NODE_ID_LENGTH;
    data.set(src.path, offset)
    offset += src.path.length;
    data.set([dests ? 254 : 255], offset);
    offset += 1;

    if (dests) {
        for (let i = 0; i < dests.length; i++) {
            data.set(textEncoder.encode(dests[i].nodeID), offset);
            offset += NODE_ID_LENGTH;
            data.set(dests[i].lastSeenPath, offset)
            offset += dests[i].lastSeenPath.length;
            data.set([i != dests.length - 1 ? 254 : 255], offset);
            offset += 1;
        }
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

export function parseBinaryMessage(data: Uint8Array): [ArrayBuffer, string, string, number, PoolMessageSourceInfo, PoolMessageDestinationInfo[] | undefined] | undefined {
    let offset = 0;
    let src: PoolMessageSourceInfo = {
        nodeID: "",
        path: [],
    };
    let dests: PoolMessageDestinationInfo[] | undefined = undefined;
    let msgID: string = "";
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
                lastSeenPath: [],
            }
            dest.nodeID = textDecoder.decode(data.subarray(offset, offset += NODE_ID_LENGTH));
            if (dest.nodeID.length != NODE_ID_LENGTH) return undefined;
            // console.log("PARSING BINARY PASS", dest.nodeID);
            let last = false;
            while (true) {
                let p = data.at(offset++);
                if (p == undefined) return undefined;
                // console.log("PARSING BINARY p", p);
                if (p == 254) {
                    break;
                } else if (p == 255) {
                    last = true;
                    break;
                }
                if (p != 0 && p != 1 && p != 2) return undefined;
                // console.log("PARSING BINARY p1", p);
                dest.lastSeenPath.push(p);
            }
            // console.log("PARSING BINARY DEST", dest);
            if (dest.lastSeenPath.length == 0 && src.nodeID != dest.nodeID) return undefined;
            // console.log("PARSING BINARY DEST1", dest);
            dests.push(dest);
            if (last) break;
        }
        // console.log("PARSING BINARY DESTS BREAK", dests);
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
    return [payload.buffer.slice(payload.byteOffset), msgID, fileID, chunkNumber, src, dests];
}