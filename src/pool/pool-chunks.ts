import { CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CACHE_CHUNK_SIZE } from "../config/caching";
import { CacheChunkMapData } from "./pool-file-manager";
import { PoolChunkRange } from "./pool.model";

export function compactChunkRanges(chunksRange: PoolChunkRange[]) {
    chunksRange.sort((a, b) => a[0] - b[0]);
    let length = chunksRange.length;
    for (let i = 1; i < length;) {
        if (chunksRange[i - 1][1] >= chunksRange[i][0]) {
            if (chunksRange[i][1] > chunksRange[i - 1][1]) {
                chunksRange[i - 1][1] = chunksRange[i][1];
            }
            chunksRange.splice(i, 1);
            length--;
        } else {
            i++;
        }
    }
}

export function getCacheChunkNumberFromChunkNumber(chunkNumber: number) {
    return Math.trunc(chunkNumber / CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR);
}

export function getCacheChunkNumberFromByteSize(byteSize: number) {
    return Math.trunc(byteSize / CACHE_CHUNK_SIZE);
}

// https://stackoverflow.com/questions/22697936/binary-search-in-javascript
export function searchPosInCacheChunkMapData(cacheChunkMapData: CacheChunkMapData, cacheChunkNumber: number) {
    var m = 0;
    var n = cacheChunkMapData.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = cacheChunkNumber - cacheChunkMapData[k].cacheChunkNumber;
        if (cmp > 0) {
            m = k + 1;
        } else if(cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return -m - 1;
}