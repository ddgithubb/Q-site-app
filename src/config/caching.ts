import { kibibytesToBytes, mebibytesToBytes } from "../utils/file-size";

const DEFAULT_MESSAGES_CACHE = 100;
const DEFAULT_RECV_MESSAGES_CACHE = 100;
const MAXIMUM_GET_LATEST_MESSAGE_LENGTH = 100;

const CHUNK_SIZE = kibibytesToBytes(64);
//export const CACHE_CHUNK_SIZE = kibibytesToBytes(128);
const CACHE_CHUNK_SIZE = mebibytesToBytes(16);
//const chunkSize = mebibytesToBytes(1);
const CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR = CACHE_CHUNK_SIZE / CHUNK_SIZE; // 256

export {
    DEFAULT_MESSAGES_CACHE,
    DEFAULT_RECV_MESSAGES_CACHE,
    MAXIMUM_GET_LATEST_MESSAGE_LENGTH,
    CHUNK_SIZE,
    CACHE_CHUNK_SIZE,
    CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR,
}