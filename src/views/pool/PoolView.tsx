import React, { createRef, LegacyRef, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PoolClient } from '../../pool/pool-client';
import { PoolConnectionState, PoolFileInfo, PoolMessageType, PoolUser } from '../../pool/pool.model';
import { getStoreState, GlobalState } from '../../store/store';
import sanitizeHtml from 'sanitize-html';
import './PoolView.css';
import { HTMLMotionProps, motion, MotionProps } from 'framer-motion';
import TextMessageIcon from '../../assets/text-message.png';
import FileIcon from '../../assets/file.png';
import UserGroupIcon from '../../assets/user-group.png';
import SettingsIcon from '../../assets/settings.png';
import DisconnectIcon from '../../assets/disconnect.png';
import AddIcon from '../../assets/add.png';
import DisconnectedIcon from '../../assets/disconnected.png';
import { fileSizeToString } from '../../helpers/file-size';
import { PoolManager } from '../../pool/global';

enum MessageMode {
    DISCONNECT,
    TEXT,
    FILE,
    USERS,
    SETTINGS,
}

type ActionBarButtonType = 'feature' | 'function' | 'utility' | 'danger';
interface ActionBarButtonProps {
    buttonType: ActionBarButtonType;
    icon: string;
    mode: MessageMode;
}

export function PoolView() {

    const navigate = useNavigate();
    const { poolID } = useParams();

    const [ messageMode, setMessageMode ] = useState<MessageMode>(MessageMode.TEXT);

    const [ poolKey, setPoolKey ] = useState<number>(0);
    const pool = useSelector((state: GlobalState) => state.pool.pools.at(poolKey));
    const poolUsers = useMemo(() => {
        if (!pool) return new Map<string, PoolUser>;
        let userMap = new Map<string, PoolUser>;
        for (const user of pool?.Users) {
            userMap.set(user.UserID, user);
        }
        return userMap;
    }, [pool?.Users]);

    const [ textAreaElement, setTextAreaElement ] = useState<HTMLDivElement | null>(null);
    const [ messagesElement, setMessagesElement ] = useState<HTMLDivElement | null>(null);
    const [ atNewestMessage, setAtNewestMessage ] = useState<boolean>(true);
    const lastFirstMessageElement = useRef<Element | null>();
    const lastFirstMessageScrollTop = useRef<number>(0);
    const lastLastMessageElement = useRef<Element | null>();
    const lastLastMessageScrollTop = useRef<number>(0);

    const cachedTextMessage = useRef<string>("");

    const shiftKeyDown = useRef<boolean>(false);
    const enterKeyDown = useRef<boolean>(false);

    useEffect(() => {
        let pools = getStoreState().pool.pools;
        if (!poolID) {
            navigate('/pool');
            return;
        }
        for (const pool of pools) {
            if (pool.PoolID == poolID) {
                setPoolKey(pool.key);
                PoolManager.connectToPool(poolID, poolKey);
                return;
            }
        }
        navigate('/pool');
    }, [])

    useEffect(() => {
        if (!pool || !messagesElement) return;
        if (atNewestMessage) {
            messagesElement?.scrollTo({ top: messagesElement.scrollHeight, behavior: "smooth" })
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
    }, [pool?.messages])

    const onMessagesScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
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

    const sendTextMessage = () => {
        if (!textAreaElement || !poolID) return;
        PoolManager.sendTextMessageToPool(poolID, textAreaElement.innerHTML)
        cachedTextMessage.current = "";
        textAreaElement.innerHTML = "";
    }

    const addFile = () => {
        document.getElementById("display-file-input")?.click();
    }

    const sendFileOffer = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !poolID) return;
        for (let i = 0; i < e.target.files.length; i++) {
            PoolManager.sendFileOfferToPool(poolID, e.target.files[i]);
        }   
    }

    const requestFile = (poolFileInfo: PoolFileInfo) => {
        if (!poolID) return;
        PoolManager.sendRequestFileToPool(poolID, poolFileInfo);
    }

    const textAreaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
        if (textAreaElement?.innerHTML.length >= (pool?.PoolSettings.maxTextLength || 5000)) {
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

    const ActionBarButton = (props: ActionBarButtonProps) => {
        return (
            <motion.div 
                className={"action-bar-button action-bar-button-" + props.buttonType + (messageMode == props.mode ? " action-bar-button-selected" : "")} 
                whileHover={{ scale: 1.2 }} 
                onClick={() => {
                    if (messageMode != props.mode) {
                        setMessageMode(props.mode);
                    }
                }}
            >
                <img className="action-bar-icon" src={props.icon} />
            </motion.div>
        )
    }

    return (
        <div className="pool-view">
            <motion.div className="pool-status-container" initial={{ y: -100 }} animate={{ y: (pool?.connectionState == PoolConnectionState.RECONNECTING ? 20 : -100) }}> 
                <div className="pool-status pool-status-disconnected">
                    <img className="pool-status-img" src={DisconnectedIcon} />
                    Lost Connection. Reconnecting...
                </div>
            </motion.div>
            {/* TODO: add fixed siaply of pool name along with # of active devices, # of active users, and # of users in general */}
            <div className="pool-messages-container" ref={(e) => setMessagesElement(e)} onScroll={onMessagesScroll}>
                <div className="pool-start-spacer">
                    <div className="pool-message-status">No saved messages beyond this point</div>
                </div>
                {
                    pool?.messages.map((msg, index) => (
                        <div className="pool-message-container" key={msg.msgID}>
                            <div className="pool-message-info-bar">
                                <div className="pool-message-name">
                                    {poolUsers.get(msg.userID)?.DisplayName}
                                </div>
                                <div className="pool-message-date">
                                    {new Date(msg.created).toLocaleTimeString('en-US')}
                                </div>
                            </div>
                            {
                                msg.type == PoolMessageType.TEXT ? (
                                    <div className="pool-message-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.data, { allowedTags: [ 'br' ] }) }}/>
                                ) : msg.type == PoolMessageType.FILE ? (
                                    <div className="pool-message-file-data-container">
                                        <div className="pool-message-file-container" onClick={() => requestFile(msg.data)}>
                                            <img src={FileIcon} width={35} height={35} />
                                            <span className="pool-message-file-name">{msg.data.fileName}</span>
                                            <span className="pool-message-file-size">{fileSizeToString(msg.data.totalSize)}</span>
                                        </div>
                                    </div>
                                ) : undefined
                            }
                        </div>
                    ))
                }
                <div className="pool-start-spacer" />
            </div>
            <div className="display-container">
                <div className="display-info-bar">
                    <div className="display-info-bar-pool-name">
                        {pool?.PoolName}
                    </div>
                    {
                        pool?.connectionState == PoolConnectionState.CONNECTED ? (
                            <div className="display-info-bar-status">
                                <div className="online-dot" />
                                <div className="display-info-bar-subtitle">
                                    {(pool?.activeNodes.length || 0) + 1} Device{(pool?.activeNodes.length || 0) + 1 == 1 ? "" : "s"} Active
                                </div>
                            </div>
                        ) : (
                            <div className="display-info-bar-status">
                                <div className="danger-dot" />
                                <div className="display-info-bar-subtitle">
                                    Connecting...
                                </div>
                            </div>
                        )
                    }
                    <div className="display-info-bar-status">
                        <div className="offline-dot" />
                        <div className="display-info-bar-subtitle">
                            {pool?.Users.length} Total User{(pool?.Users.length || 1) > 1 ? "s" : ""}
                        </div>
                    </div>
                </div>
                {
                    messageMode == MessageMode.TEXT ? (
                        <>
                            <div 
                                className="display-text-input" 
                                data-placeholder='Send Text Message' 
                                contentEditable
                                ref={(e) => setTextAreaElement(e)}
                                onKeyDown={textAreaKeyDown}
                                onKeyUp={textAreaKeyUp}
                                onBlur={textAreaBlur}
                                dangerouslySetInnerHTML={{ __html: cachedTextMessage.current }}
                                spellCheck="false"
                            />
                        </>
                    ) : messageMode == MessageMode.FILE ? (
                        <div className="display-files-container">
                            <motion.div className="display-file-container" whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)", transition: { duration: 0.1 } }} onClick={addFile}>
                                <img src={AddIcon} height={30} width={30} />
                                Add File
                            </motion.div>
                            {/* delete file(s) button with function to delete multiple files by just clicking*/}
                            {
                                pool?.myNode.fileOffers.map((poolFileInfo) => (
                                    <motion.div className="display-file-container" key={poolFileInfo.fileID} whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)", transition: { duration: 0.1 } }}>
                                        <img src={FileIcon} height={25} width={25} />
                                        <span className="display-file-name">{poolFileInfo.fileName}</span>
                                        <span className="display-file-size">{fileSizeToString(poolFileInfo.totalSize)}</span>
                                    </motion.div>
                                )) 
                            }
                        </div>
                    ) : null
                }
                <input id="display-file-input" type="file" onChange={sendFileOffer} />
            </div>
            <motion.div 
                className="action-bar" 
                initial={{ x: 150 }}
                animate={{ x: pool?.connectionState == PoolConnectionState.CONNECTED ? 0 : 150 }} 
                transition={{ type: "spring", duration: 0.5 }}
            >
                <ActionBarButton buttonType='danger' mode={MessageMode.DISCONNECT} icon={DisconnectIcon} />
                <ActionBarButton buttonType='utility' mode={MessageMode.SETTINGS} icon={SettingsIcon} />
                <ActionBarButton buttonType='utility' mode={MessageMode.USERS} icon={UserGroupIcon}/>
                <div className="action-bar-button-spacer"/>
                <ActionBarButton buttonType='feature' mode={MessageMode.FILE} icon={FileIcon}/>
                <ActionBarButton buttonType='feature' mode={MessageMode.TEXT} icon={TextMessageIcon}/>
            </motion.div>
        </div>
    )
}