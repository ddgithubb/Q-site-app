import { FileManagerClass } from "./pool-file-manager";
import { PoolManagerClass } from "./pool";

export const PoolManager: PoolManagerClass = new PoolManagerClass();
export const FileManager: FileManagerClass = new FileManagerClass();

window.addEventListener("beforeunload", (ev) => {  
    FileManager.cleanUp();
});