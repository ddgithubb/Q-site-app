
export function fileSizeToString(bytes: number, dp=1) {
    const thresh = 1024;
  
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
  
    const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    let u = -1;
    const r = 10**dp;
  
    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  
  
    return bytes.toFixed(dp) + ' ' + units[u];
}

export function kibibytesToBytes(KB: number): number {
    return KB * 1024;
}

export function mebibytesToBytes(MB: number): number {
    return MB * 1024 * 1024;
}

export function gibibytesToBytes(GB: number): number {
    return GB * 1024 * 1024 * 1024;
}