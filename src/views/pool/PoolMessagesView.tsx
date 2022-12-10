import { useState, useRef, useMemo, useEffect, memo } from 'react';
import sanitizeHtml from 'sanitize-html';
import { fileSizeToString } from '../../helpers/file-size';
import { formatDate, formatTime, minutesToMillisecond } from '../../helpers/time';
import { FileManager, PoolManager } from '../../pool/global';
import { PoolFileInfo, PoolMessageType, PoolMessageView, PoolNodeState, PoolUser } from '../../pool/pool.model';
import './PoolMessagesView.css'

import DownloadIcon from '../../assets/download.png';
import FileIcon from '../../assets/file.png';
import { PoolUserActiveDevices } from './PoolView';

const CONSISTENT_MESSAGE_INTERVAL: number = minutesToMillisecond(5);
const MIN_MESSAGE_HEIGHT: number = 28;
const MESSAGES_VIEWPORT: number = 2;
const EXTRA_MESSAGES_VIEWPORT: number = 1;
var SCROLL_THRESHOLD_FOR_CONTENT: number;
var MESSAGES_PER_VIEWPORT: number;
var MAIN_MESSAGES_TO_RENDER: number;
var MAX_MESSAGES_TO_RENDER: number;
var EXTRA_MESSAGES_TO_RENDER: number;

const calcMessageBounds = () => {
    MESSAGES_PER_VIEWPORT = window.innerHeight / MIN_MESSAGE_HEIGHT;
    SCROLL_THRESHOLD_FOR_CONTENT = window.innerHeight / 2;
    MAIN_MESSAGES_TO_RENDER = MESSAGES_VIEWPORT * MESSAGES_PER_VIEWPORT
    EXTRA_MESSAGES_TO_RENDER = EXTRA_MESSAGES_VIEWPORT * MESSAGES_PER_VIEWPORT
    MAX_MESSAGES_TO_RENDER = 2 * EXTRA_MESSAGES_TO_RENDER + MAIN_MESSAGES_TO_RENDER;
    console.log(MESSAGES_PER_VIEWPORT, MAIN_MESSAGES_TO_RENDER, EXTRA_MESSAGES_TO_RENDER, MAX_MESSAGES_TO_RENDER);
};

calcMessageBounds();
window.addEventListener("resize", calcMessageBounds);

export interface PoolMessagesViewParams {
    poolID: string;
    messages: PoolMessageView[];
    userMap: Map<string, PoolUserActiveDevices>;
}

export const PoolMessagesView = memo(PoolMessagesViewComponent);

function PoolMessagesViewComponent({ poolID, messages, userMap }: PoolMessagesViewParams) {

    const [ messagesElement, setMessagesElement ] = useState<HTMLDivElement | null>(null);
    const [ atNewestMessage, setAtNewestMessage ] = useState<boolean>(true);
    const lastFirstMessageElement = useRef<Element | null>();
    const lastFirstMessageScrollTop = useRef<number>(0);
    const lastLastMessageElement = useRef<Element | null>();
    const lastLastMessageScrollTop = useRef<number>(0);

    const [ messageIndexThreshold, setMessageIndexThreshold ] = useState<number>(MAIN_MESSAGES_TO_RENDER);
    const atTopThreshold = useRef<boolean>(false);
    const atBottomThreshold = useRef<boolean>(false);
    const poolMessagesView = useMemo(() => {
        console.log(messages.length, messageIndexThreshold, Math.max(0, messages.length - messageIndexThreshold), messages.length - messageIndexThreshold + MAX_MESSAGES_TO_RENDER);
        return messages.slice(Math.max(0, messages.length - messageIndexThreshold), messages.length - messageIndexThreshold + MAX_MESSAGES_TO_RENDER);
    }, [messages, messageIndexThreshold]);
    
    useEffect(() => {
        adjustScroll();
    }, [poolMessagesView]);

    const adjustScroll = () => {
        if (!messagesElement) return;
        if (atNewestMessage) {
            messagesElement?.scrollTo({ top: messagesElement.scrollHeight + 1000, behavior: "auto" })
        } else {
            let deltaY = 0;
            if (!messagesElement?.contains(lastLastMessageElement.current || null)) {
                deltaY = lastFirstMessageScrollTop.current - (lastFirstMessageElement.current?.scrollTop || 0)
            } else {
                deltaY = (lastLastMessageElement.current?.scrollTop || 0) - lastLastMessageScrollTop.current 
            }
            if (deltaY != 0) {
                messagesElement.scrollTo({ top: messagesElement.scrollTop + deltaY });
            }
       }
        lastFirstMessageElement.current = messagesElement.childNodes[1] as Element || null;
        lastFirstMessageScrollTop.current = (messagesElement.childNodes[1] as Element)?.scrollTop || 0;
        lastLastMessageElement.current = messagesElement.lastElementChild;
        lastLastMessageScrollTop.current = messagesElement.lastElementChild?.scrollTop || 0;
    }

    const onMessagesScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
        //console.log("SCROLLING", e.currentTarget.scrollTop, e.currentTarget.offsetHeight, e.currentTarget.scrollHeight, SCROLL_THRESHOLD_FOR_CONTENT);
        if (e.currentTarget.scrollTop + e.currentTarget.offsetHeight >= e.currentTarget.scrollHeight - SCROLL_THRESHOLD_FOR_CONTENT) {
            if (!atBottomThreshold.current && messageIndexThreshold > MAX_MESSAGES_TO_RENDER) {
                atBottomThreshold.current = true;
                // GET EXTRA BOTTOM (if needed/from indexedDB)
                console.log("GET EXTRA BOTTOM");
                setMessageIndexThreshold(messageIndexThreshold - EXTRA_MESSAGES_TO_RENDER);
            } else {
                if (e.currentTarget.scrollTop + e.currentTarget.offsetHeight + 10 >= e.currentTarget.scrollHeight) {
                    if (!atNewestMessage) {
                        setAtNewestMessage(true);
                    }
                } else {
                    if (atNewestMessage) {
                        setAtNewestMessage(false);
                    }
                }
            }
        } else if (atBottomThreshold.current) {
            atBottomThreshold.current = false;
        }
        if (e.currentTarget.scrollTop <= SCROLL_THRESHOLD_FOR_CONTENT) {
            if (!atTopThreshold.current) {
                atTopThreshold.current = true;
                // GET EXTRA TOP
                // ONLY if there is extra top, or else don't (SOLUTION RIGHT NOW DOESN"T COUNT FOR THAT)
                // NEGATIVE MESSAGEINDEXTHRESHOLD IS FINE, because there is a Math.max in the slice
                // So the only thing to add if using stored messages, is to have an EXTRA condition if there is extra top
                console.log(messages.length, messageIndexThreshold);
                console.log("GET EXTRA TOP", messages.length - messageIndexThreshold, messages.length - (messageIndexThreshold + EXTRA_MESSAGES_TO_RENDER), messages.length - messageIndexThreshold + MAX_MESSAGES_TO_RENDER);
                if (messages.length - messageIndexThreshold >= 0) {
                    setMessageIndexThreshold(messageIndexThreshold + EXTRA_MESSAGES_TO_RENDER);
                }
                //setMessageIndexThreshold(messageIndexThreshold + EXTRA_MESSAGES_TO_RENDER); // maybe should only do that when messages actually render????
            }
        } else if (atTopThreshold.current) {
            atTopThreshold.current = false;
        }
    }

    const requestFile = (poolFileInfo: PoolFileInfo) => {
        PoolManager.sendRequestFileToPool(poolID, poolFileInfo);
    }

    const requestImage = (poolInfo: PoolFileInfo) => {
        if (FileManager.hasFileDownload(poolInfo.fileID)) return;
        PoolManager.sendRequestFileToPool(poolID, poolInfo, true);
    }

    return (
        <div className="pool-messages-container" ref={(e) => setMessagesElement(e)} onScroll={onMessagesScroll}>
            <div className="pool-start-spacer">
                <div className="pool-message-status">No saved messages beyond this point</div>
            </div>
            {
                poolMessagesView.map((msg, index) => (
                    <div className="pool-message-container" key={msg.msgID}>
                        {
                            (
                                index == 0 || 
                                // msg.nodeID != pool.messages[index - 1].nodeID || should be deviceID
                                msg.created - messages[index - 1].created > CONSISTENT_MESSAGE_INTERVAL ||
                                (messages[index - 1].type != PoolMessageType.TEXT && 
                                messages[index - 1].type != PoolMessageType.FILE && 
                                messages[index - 1].type != PoolMessageType.IMAGE)
                            )
                            && (msg.type == PoolMessageType.TEXT || msg.type == PoolMessageType.FILE || msg.type == PoolMessageType.IMAGE)
                            ? (
                                <div className="pool-message-info-bar">
                                    <div className="pool-message-name">
                                        {userMap.get(msg.userID)?.user.DisplayName}
                                    </div>
                                    <div className="pool-message-date">
                                        {formatDate(msg.created)}
                                    </div>
                                </div>
                            ) : (
                                <div className="pool-message-date pool-message-portable-date">{formatTime(msg.created)}</div>
                            )
                        }
                        {
                            msg.type == PoolMessageType.SIGNAL_STATUS ? (
                                <div className="pool-message-node-status">{msg.data.nodeID} {userMap.get(msg.data.userID)?.user.DisplayName} has {msg.data.state == PoolNodeState.ACTIVE ? "joined" : "left"}</div>
                            ) : msg.type == PoolMessageType.TEXT ? (
                                <div className="pool-message-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.data, { allowedTags: [ 'br' ] }) }}/>
                            ) : msg.type == PoolMessageType.FILE ? (
                                <div className="pool-message-file-data-container">
                                    <div className="pool-message-file-container" onClick={() => requestFile(msg.data)}>
                                        <img src={FileIcon} width={35} height={35} />
                                        <span className="pool-message-file-name">{msg.data.fileName}</span>
                                        <span className="pool-message-file-size">{fileSizeToString(msg.data.totalSize)}</span>
                                    </div>
                                </div>
                            ) : msg.type == PoolMessageType.IMAGE ? (
                                <>
                                    <div className="pool-message-image-container">
                                        <div className="pool-message-image-sub-container">
                                            <img loading="lazy" className={"pool-message-image" + (!FileManager.hasMediaCache(msg.data.fileInfo.fileID) ? " pool-message-image-preview-blur" : "")} src={FileManager.getMediaCache(msg.data.fileInfo.fileID) || msg.data.previewImage} height={Math.min(400, (msg.data.height / msg.data.width) * Math.min(400, msg.data.width))} />
                                            {
                                                !FileManager.hasMediaCache(msg.data.fileInfo.fileID) ? (
                                                    <div className="pool-message-image-missing-container" onClick={() => requestImage(msg.data.fileInfo)}>
                                                        {FileManager.hasFileDownload(msg.data.fileInfo.fileID) ? "Requesting..." : "Request Image"}
                                                    </div>
                                                ) : undefined
                                            }
                                        </div>
                                    </div>
                                    {
                                        FileManager.hasMediaCache(msg.data.fileInfo.fileID) ? (
                                            <div className="pool-message-image-download-container">
                                                <img className="pool-message-image-download-icon" src={DownloadIcon} />
                                                <div className="pool-message-image-download-filename" onClick={() => requestFile(msg.data.fileInfo)}>
                                                    {msg.data.fileInfo.fileName} {" (" + fileSizeToString(msg.data.fileInfo.totalSize) + ")"}
                                                </div>
                                            </div>
                                        ) : undefined
                                    }
                                </>
                            ) : undefined
                        }
                    </div>
                ))
            }
            <div className="pool-end-spacer" />
        </div>
    )
}