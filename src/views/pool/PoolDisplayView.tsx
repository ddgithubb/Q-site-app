
import { useState, useRef, memo, useEffect } from 'react'
import { CircularProgressbar } from 'react-circular-progressbar'
import { fileSizeToString } from '../../helpers/file-size'
import { FileManager, PoolManager } from '../../pool/global'
import { Pool, PoolConnectionState, PoolDownloadProgressStatus, PoolFileOffer } from '../../pool/pool.model'
import { IndicatorDot } from '../components/IndicatorDot'
import { PoolDisplayUsersView } from './PoolDisplayUsersView'
import { PoolMessageMode, UserMapType } from './PoolView'
import { isMobile } from 'react-device-detect'

import './PoolDisplayView.css'
import AddIcon from '../../assets/add.png'
import AddImageIcon from '../../assets/add-image.png'
import FileIcon from '../../assets/file.png'
import CancelIcon from '../../assets/trash.png'
import SendIcon from '../../assets/send.png'

export interface PoolDisplayViewParams {
    pool: Pool;
    messageMode: PoolMessageMode;
    userMap: UserMapType;
}

export const PoolDisplayView = memo(PoolDisplayViewComponent); 

function PoolDisplayViewComponent({ pool, messageMode, userMap }: PoolDisplayViewParams) {
    
    const [ textAreaElement, setTextAreaElement ] = useState<HTMLDivElement | null>(null);

    const cachedTextMessage = useRef<string>("");

    const shiftKeyDown = useRef<boolean>(false);
    const enterKeyDown = useRef<boolean>(false);

    const sendTextMessage = () => {
        if (!textAreaElement) return;
        if (textAreaElement.innerHTML == "") return;
        PoolManager.sendTextMessageToPool(pool.poolID, textAreaElement.innerHTML)
        cachedTextMessage.current = "";
        textAreaElement.innerHTML = "";
    }

    const addFile = () => {
        // if (FileManager.fileSystemAccess) {
        //     window.showOpenFilePicker(FILE_PICKER_OPTS).then(async (fsfh) => {
        //         for (let i = 0; i < fsfh.length; i++) {
        //             let file = await fsfh[i].getFile();
        //             if (!poolID) return;
        //             PoolManager.sendFileOfferToPool(poolID, file, fsfh[i]);
        //         }
        //     });
        //     return;
        // }
        document.getElementById("display-file-input")?.click();
    }

    const addImage = () => {
        document.getElementById("display-image-input")?.click();
    }

    const sendFileOffer = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        for (let i = 0; i < e.target.files.length; i++) {
            PoolManager.sendFileOfferToPool(pool.poolID, e.target.files[i]);
        }
    }

    const sendImageOffer = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        for (let i = 0; i < e.target.files.length; i++) {
            PoolManager.sendImageOfferToPool(pool.poolID, e.target.files[i]);
        }
    }

    const sendRetractFileOffer = (fileID: string) => {
        PoolManager.sendRetractFileOffer(pool.poolID, fileID);
    }

    const textAreaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // if (textAreaElement) {
        //     if (e.key != 'Enter') textAreaElement.innerHTML = e.key;
        // }
        if (isMobile) return;
        if (e.key == 'Enter') {
            enterKeyDown.current = true;
            if (!shiftKeyDown.current) {
                e.preventDefault();
                sendTextMessage();
                return
            }
        } else if (e.key == 'Shift') {
            shiftKeyDown.current = true;
        }
        if (!textAreaElement) return
        if (textAreaElement?.innerHTML.length >= (pool.poolSettings.maxTextLength || 5000)) {
            e.preventDefault();
        }
        textAreaElement?.scrollTo({ top: textAreaElement.scrollHeight });
    }   

    const textAreaKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key == 'Enter') {
            enterKeyDown.current = false;
        } else if (e.key == 'Shift') {
            shiftKeyDown.current = false;
        }
    }

    const textAreaBlur = () => {
        if (!textAreaElement) return;
        cachedTextMessage.current = textAreaElement?.innerHTML
    }

    return (
        <div className="display-container">
            <div className="display-overlay-container">
                <DownloadQueue poolID={pool.poolID} downloadQueue={pool.downloadQueue} />
            </div>
            <div className="display-info-bar">
                <div className="display-info-bar-pool-name">
                    {pool.poolName}
                </div>
                {
                    pool.connectionState == PoolConnectionState.CONNECTED ? (
                        <div className="display-info-bar-status">
                            <IndicatorDot type="online"/>
                            <div className="display-info-bar-subtitle">
                                {pool.activeNodes.length || 0} Device{(pool.activeNodes.length || 0) == 1 ? "" : "s"} Active
                            </div>
                        </div>
                    ) : (
                        <div className="display-info-bar-status">
                            <IndicatorDot type="danger"/>
                            <div className="display-info-bar-subtitle">
                                Connecting...
                            </div>
                        </div>
                    )
                }
                <div className="display-info-bar-status">
                    <IndicatorDot type="offline"/>
                    <div className="display-info-bar-subtitle">
                        {pool.users.length} Total User{(pool.users.length || 1) > 1 ? "s" : ""}
                    </div>
                </div>
            </div>
            <div className="display-toggle-hide display-message-input" aria-hidden={messageMode != PoolMessageMode.TEXT}>
                <div 
                    className="display-component-container display-text-input" 
                    data-placeholder='Send Text Message' 
                    contentEditable
                    ref={(e) => setTextAreaElement(e)}
                    onKeyDown={textAreaKeyDown}
                    onKeyUp={textAreaKeyUp}
                    onBlur={textAreaBlur}
                    dangerouslySetInnerHTML={{ __html: cachedTextMessage.current }}
                    spellCheck="false"
                />
                <div className="display-message-input-icons">
                    <img className="display-message-input-icon" src={AddImageIcon} onClick={addImage} />
                    {
                        isMobile ? <img className="display-message-input-icon display-message-send-icon" src={SendIcon} onTouchEnd={(e) => { sendTextMessage(); e.preventDefault() }}/> : null
                    }
                </div>
            </div>
            <div className="display-toggle-hide display-component-container display-files-container" aria-hidden={messageMode != PoolMessageMode.FILE}>
                <div className="display-file-container display-file-container-add-button" onClick={addFile}>
                    <img src={AddIcon} height={28} width={28} />
                    Add File
                </div>
                {/* delete file(s) button with function to delete multiple files by just clicking*/}
                {
                    FileManager.getFileOffers(pool.poolID)?.map((poolFileInfo) => (
                        <div className="display-cancel-button-container" key={poolFileInfo.fileID} onClick={() => sendRetractFileOffer(poolFileInfo.fileID)}>
                            <div className="display-file-container display-cancel-button-child elipsify-container">
                                <img src={FileIcon} height={22} width={22} />
                                <span className="display-file-name elipsify-content">{poolFileInfo.fileName}</span>
                                <span className="display-file-size elipsify-extra">{fileSizeToString(poolFileInfo.totalSize)}</span>
                            </div>
                            <img className="display-cancel-button-icon" src={CancelIcon}/>
                        </div>
                    ))
                }
            </div>
            <PoolDisplayUsersView poolID={pool.poolID || ""} users={pool.users || []} userMap={userMap} hidden={messageMode != PoolMessageMode.USERS}/>
            <input className="hideInput" id="display-file-input" type="file" onChange={sendFileOffer} />
            <input className="hideInput" id="display-image-input" type="file" accept=".png,.jpg" onChange={sendImageOffer} />
        </div>
    )
}

function DownloadQueue({ poolID, downloadQueue }: { poolID: string, downloadQueue: PoolFileOffer[] } ) {

    const refreshTimer = useRef<NodeJS.Timer | undefined>(undefined);
    const [lastUpdate, setLastUpdate] = useState<number>(0);

    useEffect(() => {
        if (downloadQueue.length != 0) {
            if (refreshTimer.current == undefined) {
                refreshTimer.current = setInterval(() => {
                    //console.log("DQ FORCE UPDATE");
                    setLastUpdate(Date.now());
                }, 100);
            }
        } else {
            clearInterval(refreshTimer.current);
            refreshTimer.current = undefined;
        }
    }, [downloadQueue]);

    return (
        <div className="display-downloading-files-container">
            {
                downloadQueue.map((fileOffer) => (
                    <div 
                        className="display-cancel-button-container display-downloading-file-container" 
                        onClick={() => PoolManager.sendRemoveFileRequest(poolID, fileOffer)}
                        key={fileOffer.fileID}>
                        <div className="display-downloading-file display-cancel-button-child">
                            <div className="display-downloading-file-progress">
                                <CircularProgressbar 
                                    value={FileManager.getFileDownloadProgress(fileOffer.fileID)} 
                                    strokeWidth={15} 
                                    styles={{
                                        path: {
                                            stroke: `rgb(${getRGBFromDownloadProgressStatus(FileManager.getFileDownloadStatus(fileOffer.fileID))})`,
                                        },
                                        trail: {
                                            stroke: `rgba(${getRGBFromDownloadProgressStatus(FileManager.getFileDownloadStatus(fileOffer.fileID))}, 0.1)`
                                        }
                                    }} />
                            </div>
                            <div className="display-downloading-file-name">
                                {fileOffer.fileName}
                            </div>
                        </div>
                        <img className="display-cancel-button-icon" src={CancelIcon}/>
                    </div>
                ))
            }
        </div>
    )
}

function getRGBFromDownloadProgressStatus(status: PoolDownloadProgressStatus): string {
    if (status == PoolDownloadProgressStatus.DOWNLOADING) {
        return "84, 140, 230";
    } else if (status == PoolDownloadProgressStatus.RETRYING) {
        return "204, 217, 34";
    } else if (status == PoolDownloadProgressStatus.UNAVAILABLE) {
        return "212, 51, 51";
    }
    return "";
}