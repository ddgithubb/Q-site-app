import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PoolConnectionState, PoolInfo, PoolNode } from '../../pool/pool.model';
import { getStoreState, GlobalState, store } from '../../store/store';
import { motion } from 'framer-motion';
import { mebibytesToBytes } from '../../utils/file-size';
import { PoolManager } from '../../pool/global';
import { PoolMessagesView } from './PoolMessagesView';
import { isMobile } from 'react-device-detect';

import './PoolView.css';
import TextMessageIcon from '../../assets/text-message.png';
import FileIcon from '../../assets/file.png';
import UserGroupIcon from '../../assets/user-group.png';
import SettingsIcon from '../../assets/settings.png';
import DisconnectedIcon from '../../assets/disconnected.png';
import DisconnectIcon from '../../assets/disconnect.png';
import { PoolDisplayView } from './PoolDisplayView';
import { poolAction } from '../../store/slices/pool.slice';
import { profileAction } from '../../store/slices/profile.slice';
import { PoolUserInfo } from '../../pool/sync_server.v1';

export enum PoolMessageMode {
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
    mode: PoolMessageMode;
    messageMode: PoolMessageMode;
    setMessageMode: React.Dispatch<React.SetStateAction<PoolMessageMode>>;
}

export type UserMapType = Map<string, PoolUserActiveDevices>;

export function PoolContainerView() {
    const navigate = useNavigate();
    const { poolID } = useParams();
    const [ searchParams ] = useSearchParams();
    const [ poolKey, setPoolKey ] = useState<number>(0);

    useEffect(() => {
        if (!poolID) {
            navigate('/pool');
            return;
        }

        // TEMP 
        let displayName = searchParams.get("displayName");
        if (displayName == null) {
            navigate('/join-pool?poolid=' + poolID);
            return;
        }
        store.dispatch(profileAction.setDisplayName(displayName));
        store.dispatch(poolAction.initPools([
        {
            poolID: poolID,
            poolName: poolID,
            users: [],
            key: 0,
            settings: {
                maxTextLength: 5000,
                maxMediaSize: mebibytesToBytes(32),
            }
        } as PoolInfo]));
        // TEMP

        let pools = getStoreState().pool.pools;
        for (const pool of pools) {
            if (pool.poolID == poolID) {
                setPoolKey(pool.key);
                PoolManager.connectToPool(poolID, poolKey);
                return;
            }
        }

        console.log("Going to pool");
        navigate('/pool');
    }, [])

    if (!poolID && !poolKey) {
        return null
    } else {
        return <PoolView poolID={poolID!} poolKey={poolKey} />
    }
}

export interface PoolUserActiveDevices {
    user: PoolUserInfo;
    activeDevices: Map<String, PoolNode> | undefined;
}

export function PoolView({ poolID, poolKey }: { poolID: string, poolKey: number }) {

    const [ messageMode, setMessageMode ] = useState<PoolMessageMode>(PoolMessageMode.TEXT);
    const pool = useSelector((state: GlobalState) => state.pool.pools.at(poolKey));
    const navigate = useNavigate();
    const userMap = useMemo<UserMapType>(() => {
        if (!pool) return new Map<string, PoolUserActiveDevices>();
        let userMap = new Map<string, PoolUserActiveDevices>();
        for (const user of pool.users) {
            let userAndDevices: PoolUserActiveDevices = {
                user: user,
                activeDevices: undefined,
            };
            userMap.set(user.userId, userAndDevices);
        }
        for (const activeNode of pool.activeNodes) {
            let userAndDevices = userMap.get(activeNode.userID);
            if (!userAndDevices) continue;
            if (!userAndDevices.activeDevices) {
                userAndDevices.activeDevices = new Map<String, PoolNode>();
            }
            userAndDevices.activeDevices.set(activeNode.deviceID, activeNode);
        }
        //console.log(userMap);
        return userMap;
    }, [pool?.users, pool?.activeNodes]);

    useEffect(() => {
        if (messageMode == PoolMessageMode.DISCONNECT) {
            PoolManager.disconnectFromPool(poolID, poolKey);
            navigate('/');
        }
    }, [messageMode]);

    return (
        <div className="pool-view">
            {/* TODO: add fixed siaply of pool name along with # of active devices, # of active users, and # of users in general */}
            <PoolMessagesView poolID={poolID} messages={pool?.messages || []} userMap={userMap} downloadQueue={pool?.downloadQueue || []} />
            {
                pool ? (
                    <PoolDisplayView pool={pool} messageMode={messageMode} userMap={userMap} />
                ) : null
            }
            <ActionBar connectionState={pool?.connectionState || PoolConnectionState.CLOSED } messageMode={messageMode} setMessageMode={setMessageMode} />
            <motion.div className="pool-status-container" initial={{ y: -100 }} animate={{ y: (pool?.connectionState == PoolConnectionState.RECONNECTING ? 20 : -100) }}> 
                <div className="pool-status pool-status-disconnected">
                    <img className="pool-status-img" src={DisconnectedIcon} />
                    Lost Connection. Reconnecting...
                </div>
            </motion.div>
        </div>
    )
}

const ActionBar = memo(ActionBarComponent);

function ActionBarComponent({ connectionState, messageMode, setMessageMode }: { connectionState: PoolConnectionState, messageMode: PoolMessageMode, setMessageMode: React.Dispatch<React.SetStateAction<PoolMessageMode>> }) {
    
    const [ active, setActive ] = useState<boolean>(true);
    const activeTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    const wrapperRef = useRef<any>(null);

    useEffect(() => {
        if (!isMobile) return;
        if (active) {
            clearTimeout(activeTimeout.current);
            activeTimeout.current = setTimeout(() => {
                setActive(false);
            }, 10000);
        }
    }, [active]);

    useEffect(() => {
        if (!isMobile) return;
        function handleClickOutside(event: any) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setActive(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
      }, [wrapperRef]);

    return (
        <motion.div 
            className="action-bar" 
            initial={{ x: 150, opacity: 1 }}
            animate={{ x: connectionState == PoolConnectionState.CONNECTED ? 0 : 150, opacity: active ? 1 : 0.50 }} 
            transition={{ type: "spring", duration: 0.5 }} 
            onClick={() => isMobile && setActive(true)} 
            ref={wrapperRef}
        >
            <ActionBarButton buttonType='danger' mode={PoolMessageMode.DISCONNECT} icon={DisconnectIcon} messageMode={messageMode} setMessageMode={setMessageMode} />
            <ActionBarButton buttonType='utility' mode={PoolMessageMode.SETTINGS} icon={SettingsIcon} messageMode={messageMode} setMessageMode={setMessageMode} />
            <ActionBarButton buttonType='utility' mode={PoolMessageMode.USERS} icon={UserGroupIcon} messageMode={messageMode} setMessageMode={setMessageMode}/>
            <div className="action-bar-button-spacer"/>
            <ActionBarButton buttonType='feature' mode={PoolMessageMode.FILE} icon={FileIcon} messageMode={messageMode} setMessageMode={setMessageMode}/>
            <ActionBarButton buttonType='feature' mode={PoolMessageMode.TEXT} icon={TextMessageIcon} messageMode={messageMode} setMessageMode={setMessageMode}/>
        </motion.div>
    )
}

const ActionBarButton = memo(ActionBarButtonComponent);

function ActionBarButtonComponent(props: ActionBarButtonProps) {
    return (
        <div 
            className={"action-bar-button action-bar-button-" + props.buttonType + (props.messageMode == props.mode ? " action-bar-button-selected" : "")} 
            onClick={() => {
                if (props.messageMode != props.mode) {
                    props.setMessageMode(props.mode);
                }
            }}
        >
            <img className="action-bar-icon" src={props.icon} />
        </div>
    )
}