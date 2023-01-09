import _m0 from "protobufjs/minimal";

export function setMessagePackageDestVisited(encodedMsgPkg: Uint8Array, targetNodeID: string) {
    const reader = new _m0.Reader(encodedMsgPkg);
    // console.log("PACKAGE DEST VISITED BEFORE:", targetNodeID);
    while (reader.pos < reader.len) {
        const tag = reader.uint32();
        switch (tag >>> 3) {
            case 2:
                let nodeID = "";
                let end = reader.pos + reader.uint32();
                // console.log("FOUND ONE DEST");
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1:
                            nodeID = reader.string();
                            // console.log("FOUND NODEID", nodeID);
                            break;
                        case 2:
                            // console.log("FOUND BOOL");
                            if (nodeID == targetNodeID) {
                                // console.log("PACKAGE DEST VISITED FOUND", targetNodeID);
                                encodedMsgPkg.set([1], reader.pos);
                                // console.log("PACKAGE DEST VISITED AFTER:", PoolMessagePackage.decode(encodedMsgPkg))
                                return;
                            }
                            reader.bool();
                            break;
                        default:
                            reader.skipType(tag & 7);
                            break;
                    }
                }
                break;
            default:
                reader.skipType(tag & 7);
                break;
        }
    }
    // console.log("PACKAGE DEST VISITED NOT FOUND");
}