import { CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR, CACHE_CHUNK_SIZE } from "../config/caching";
// import { CacheChunkMapData } from "./pool-file-manager";
import { PoolChunkRange } from "./pool.v1";

// Worst case: O(n^2) (due to removal)
// Average case: O(nlogn)
// Best case: O(n) (due to checks)
export function compactChunkRanges(chunkRanges: PoolChunkRange[]) {
    let compacted = true;

    for (let i = chunkRanges.length - 2; i >= 0; i--) {
        if (chunkRanges[i + 1].start > chunkRanges[i + 1].end) {
            chunkRanges.splice(i + 1, 1);
            continue;
        }
        if (chunkRanges[i].start > chunkRanges[i].end) {
            chunkRanges.splice(i, 1);
            continue;
        }
        if (chunkRanges[i].end + 1 >= chunkRanges[i + 1].start) {
            compacted = false;
        }
        // continue because need to filter out all the start > end
    }

    if (compacted) return;

    chunkRanges.sort((a, b) => a.start - b.start);
    let length = chunkRanges.length;
    for (let i = 1; i < length;) {
        if (chunkRanges[i - 1].end + 1 >= chunkRanges[i].start) {
            if (chunkRanges[i].end > chunkRanges[i - 1].end) {
                // chunkRanges[i - 1].end = chunkRanges[i].end;
                // chunkRanges are supposed to be immutable
                chunkRanges[i - 1] = {
                    start: chunkRanges[i - 1].start,
                    end: chunkRanges[i].end,
                };
            }
            chunkRanges.splice(i, 1);
            length--;
        } else {
            i++;
        }
    }
}

export function addToChunkRanges(chunkRange: PoolChunkRange, chunkRanges: PoolChunkRange[]) {
    if (chunkRanges.length == 0) {
        chunkRanges.push(chunkRange);
        return;
    }
    let pos = searchPosInChunkRanges(chunkRange.start, chunkRanges);
    if (pos < 0) {
        pos = (-pos - 1);
        if (pos != 0 && chunkRanges[pos - 1].end + 1 >= chunkRange.start) {
            chunkRanges[pos - 1] = {
                start: chunkRanges[pos - 1].start,
                end: chunkRange.end,
            };
            pos--;
        } else if (chunkRanges[pos].start - 1 <= chunkRange.end) {
            chunkRanges[pos] = {
                start: chunkRange.start,
                end: Math.max(chunkRange.end, chunkRanges[pos].end),
            };
        } else {
            chunkRanges.splice(pos, 0, chunkRange);
            return;
        }
    } else {
        if (chunkRange.end <= chunkRanges[pos].end) {
            return;
        }
        chunkRanges[pos] = {
            start: chunkRanges[pos].start,
            end: chunkRange.end,
        };
    }
    let length = chunkRanges.length;
    for (let i = pos + 1; i < length;) {
        if (chunkRanges[i - 1].end + 1 >= chunkRanges[i].start) {
            if (chunkRanges[i].end > chunkRanges[i - 1].end) {
                chunkRanges[i - 1] = {
                    start: chunkRanges[i - 1].start,
                    end: chunkRanges[i].end,
                };
            }
            chunkRanges.splice(i, 1);
            length--;
        } else {
            break;
        }
    }
}

// precondition: chunkRanges abide within a cacheChunkNumber
export function deleteCacheChunkFromChunkRanges(cacheChunkNumber: number, chunkRanges: PoolChunkRange[]) {
    let pos = searchPosInChunkRanges(getChunkNumberFromCacheChunkNumber(cacheChunkNumber), chunkRanges);
    if (pos < 0) {
        pos = (-pos - 1);
    }
    let delAmount = 0;
    let i = pos;
    for (; i < chunkRanges.length; i++) {
        if (getCacheChunkNumberFromChunkNumber(chunkRanges[i].start) != cacheChunkNumber) {
            break;
        }
        delAmount++;
    }
    if (delAmount != 0) {
        chunkRanges.splice(pos, delAmount);
    }
}

// https://stackoverflow.com/questions/22697936/binary-search-in-javascript
// pos is at beginning of multiple same values
// (-pos - 1) is where it should go if value not found
export function searchPosInChunkRanges(chunkRangeStart: number, chunkRanges: PoolChunkRange[]) {
    var m = 0;
    var n = chunkRanges.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = chunkRangeStart - chunkRanges[k].start;
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

// chunkRanges1 & !chunkRanges2 (Set difference)
export function calcChunkRangesDifference(chunkRanges1: PoolChunkRange[], chunkRanges2: PoolChunkRange[], compacted: boolean = false): PoolChunkRange[] {
    let diffChunkRanges: PoolChunkRange[] = [];
    if (!compacted) {
        compactChunkRanges(chunkRanges1);
        compactChunkRanges(chunkRanges2);
    }

    if (chunkRanges1.length == 0) return diffChunkRanges;

    let i1 = 0;
    let i2 = 0;
    let start = chunkRanges1[0].start;
    let end = chunkRanges1[0].end;
    while (i1 < chunkRanges1.length) {
        for (; i2 < chunkRanges2.length; i2++) {
            if (inChunkRange(start, chunkRanges2[i2])) {
                start = chunkRanges2[i2].end + 1;
                break;
            }
            if (start < chunkRanges2[i2].start) {
                diffChunkRanges.push({
                    start: start,
                    end: Math.min(end, chunkRanges2[i2].start - 1),
                });
                break;
            }
        }
        if (start > end) {
            // no diff, pass
        } else if (i2 >= chunkRanges2.length) {
            diffChunkRanges.push({
                start,
                end,
            })
        } else if (end > chunkRanges2[i2].end) {
            start = chunkRanges2[i2].end + 1;
            continue;
        }
        i1++;
        if (i1 < chunkRanges1.length) {
            start = chunkRanges1[i1].start;
            end = chunkRanges1[i1].end;
        }
    }

    return diffChunkRanges;
}

// chunkRanges1 & chunkRanges2 (Set intersection)
export function calcChunkRangesIntersection(chunkRanges1: PoolChunkRange[], chunkRanges2: PoolChunkRange[], compacted: boolean = false) {
    let interChunkRanges: PoolChunkRange[] = [];
    if (!compacted) {
        compactChunkRanges(chunkRanges1);
        compactChunkRanges(chunkRanges2);
    }

    let i1 = 0;
    let i2 = 0;
    while (i1 < chunkRanges1.length && i2 < chunkRanges2.length) {
        let start = Math.max(chunkRanges1[i1].start, chunkRanges2[i2].start);
        let end = Math.min(chunkRanges1[i1].end, chunkRanges2[i2].end);

        if (start <= end) {
            interChunkRanges.push({
                start,
                end,
            })
        }

        if (chunkRanges1[i1].end < chunkRanges2[i2].end) {
            i1++;
        } else {
            i2++;
        }
    }
    return interChunkRanges;
}

// Average: O(n)
export function mapPromisedChunks(promisedChunks: PoolChunkRange[]): Map<number, PoolChunkRange[]> {
    let promisedChunksMap = new Map<number, PoolChunkRange[]>();
    if (promisedChunks.length != 0) {
        // File request should only contain promisedChunks within their own cache chunk range
        for (const chunkRange of promisedChunks) {
            let cacheChunkNumber = getCacheChunkNumberFromChunkNumber(chunkRange.start);
            if (cacheChunkNumber != getCacheChunkNumberFromChunkNumber(chunkRange.end) || cacheChunkNumber < 0) continue;
            let curChunkRanges = promisedChunksMap.get(cacheChunkNumber);
            if (!curChunkRanges) {
                curChunkRanges = [];
                promisedChunksMap.set(cacheChunkNumber, curChunkRanges);
            }
            addToChunkRanges(chunkRange, curChunkRanges);
        }
    }
    return promisedChunksMap;
}

export function existsInChunkRanges(chunkNumber: number, chunkRanges: PoolChunkRange[]): PoolChunkRange | undefined {
    for (let i = 0; i < chunkRanges.length; i++) {
        if (inChunkRange(chunkNumber, chunkRanges[i])) {
            return chunkRanges[i];
        }
    }
    return undefined
}

export function inChunkRange(chunkNumber: number, chunkRange: PoolChunkRange) {
    return chunkNumber >= chunkRange.start && chunkNumber <= chunkRange.end;
}

export function getCacheChunkNumberFromChunkNumber(chunkNumber: number): number {
    return Math.trunc(chunkNumber / CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR);
}

export function getCacheChunkNumberFromByteSize(byteSize: number): number {
    return Math.trunc(byteSize / CACHE_CHUNK_SIZE);
}

export function getChunkNumberFromCacheChunkNumber(cacheChunkNumber: number): number {
    return cacheChunkNumber * CACHE_CHUNK_TO_CHUNK_SIZE_FACTOR;
}

export function getPartnerIntFromCacheChunkNumber(cacheChunkNumber: number): number {
    return cacheChunkNumber % 3;
}