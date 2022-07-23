
export enum PoolMessageType {
    SIGNAL_STATUS,
    GET_LATEST, // statuses/avail files/messages (max # of messages if just joined)
    TEXT,
    FILE,
    REQUEST_FILE,
    SEND_FILE_SHARD,
}

export interface PoolMessage {
    src: {
        userID: string
        nodeID: string;
        path: number[];
    }
    dest?: {
        nodeID: string;
        last_seen_path: number[];
    }
    id: string;
    type: PoolMessageType;
    data: any;
}