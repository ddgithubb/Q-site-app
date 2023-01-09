
export function checkFileExist(file: File): Promise<boolean> { // ONLY WORKS FOR FILES CREATED IN THE SESSION
    let resolve: (value: boolean | PromiseLike<boolean>) => void;
    let reject: (reason?: any) => void
    let promise = new Promise<boolean>((res, rej) => {
        resolve = res;
        reject = rej;
    })
    let fileReader = new FileReader();
    fileReader.onloadend = (e) => {
        resolve(e.target?.error == null);
        //console.log("FILE DOESN'T EXIST", e.target?.error != null);
    }
    fileReader.readAsArrayBuffer(file.slice(0, 1));
    return promise;
}

const PERMISSION_DESCRIPTOR_OPTS: FileSystemHandlePermissionDescriptor = {
    mode: 'readwrite'
};

export async function verifyFileHandlePermission(fileHandle: FileSystemFileHandle) { // ONLY WORKS IN SECURE CONTEXT
    
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(PERMISSION_DESCRIPTOR_OPTS)) === 'granted') {
        return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(PERMISSION_DESCRIPTOR_OPTS)) === 'granted') {
        return true;
    }
    
    // The user didn't grant permission, so return false.
    return false;
}