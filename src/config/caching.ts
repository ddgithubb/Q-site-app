import { kibibytesToBytes, mebibytesToBytes } from "../helpers/file-size";

const DEFAULT_MESSAGES_CACHE = 100;
const DEFAULT_RECV_MESSAGES_CACHE = 50;
const MAXIMUM_GET_LATEST_MESSAGE_LENGTH = 50;

const CHUNK_SIZE = kibibytesToBytes(16);
//export const CACHE_CHUNK_SIZE = kibibytesToBytes(128);
const CACHE_CHUNK_SIZE = mebibytesToBytes(1);
//const chunkSize = mebibytesToBytes(1);
const CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR = CACHE_CHUNK_SIZE / CHUNK_SIZE;

export {
    DEFAULT_MESSAGES_CACHE,
    DEFAULT_RECV_MESSAGES_CACHE,
    MAXIMUM_GET_LATEST_MESSAGE_LENGTH,
    CHUNK_SIZE,
    CACHE_CHUNK_SIZE,
    CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR,
}