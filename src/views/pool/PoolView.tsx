import React, { createRef, LegacyRef, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConnectToPool } from '../../pool/connect-pool';
import { PoolClient } from '../../pool/pool-client';
import { PoolMessageType, PoolUser } from '../../pool/pool.model';
import { getStoreState, GlobalState } from '../../store/store';
import './PoolView.css';

export function PoolView() {

    const navigate = useNavigate();
    const { poolID } = useParams();
    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ messageMode, setMessageMode ] = useState();

    const [ poolKey, setPoolKey ] = useState<number>(0);
    const pool = useSelector((state: GlobalState) => state.pool.pools.at(poolKey));
    const [ poolClient, setPoolClient ] = useState<PoolClient>();
    const poolUsers = useMemo(() => {
        if (!pool) return new Map<string, PoolUser>;
        let userMap = new Map<string, PoolUser>;
        for (const user of pool?.users) {
            userMap.set(user.userID, user);
        }
        return userMap;
    }, [pool?.users]);

    const [ textRows, setTextRows ] = useState<number>(1);
    const [ textMessage, setTextMessage ] = useState<string>("");
    const [ textAreaElement, setTextAreaElement ] = useState<HTMLTextAreaElement | null>(null);

    const shiftKeyDown = useRef<boolean>(false);
    const enterKeyDown = useRef<boolean>(false);
    const backspacePressed = useRef<boolean>(false);
    const messagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let key = searchParams.get("key");
        let pools = getStoreState().pool.pools;
        if (!poolID) {
            navigate('/pool');
            return;
        }
        if (key) {
            let poolKey = parseInt(key);
            if (poolKey >= pools.length || poolKey < 0 || pools[poolKey].poolID != poolID) {
                navigate('/pool');
                return;
            }
            setPoolKey(poolKey);
            setPoolClient(ConnectToPool(poolID, poolKey, true));
        } else {
            for (const pool of pools) {
                if (pool.poolID == poolID) {
                    setPoolKey(pool.key);
                    setPoolClient(ConnectToPool(poolID, pool.key, true));
                    return;
                }
            }
            navigate('/pool');
        }
    }, [])

    useEffect(() => {
        messagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pool?.messages])

    const sendTextMessage = () => {
        poolClient?.sendTextMessage(textMessage);
        setTextMessage("");
        setTextRows(1);
    }

    const textAreaChange = (e: any) => {
        
        if (e.target.value == "") {
            setTextRows(1);
        }
        if (textAreaElement?.scrollHeight! > textAreaElement?.offsetHeight!) {
            if (textRows <= 6) {
                setTextRows(textRows + 1);
            }
        }
        if (backspacePressed.current) {
            // let len = e.target.value.split('\n').length;
            // if (len < textRows) {
            //     setTextRows(len);
            // }
            backspacePressed.current = false;
        }
        setTextMessage(e.target.value);
    }

    const textAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key == "Backspace") {
            backspacePressed.current = true;
        } else if (e.key == 'Enter') {
            enterKeyDown.current = true;
            if (!shiftKeyDown.current) {
                sendTextMessage();
                return
            }
        } else if (e.key == 'Shift') {
            shiftKeyDown.current = true;
        }
        if (enterKeyDown.current && shiftKeyDown.current) {
            if (textRows <= 6) {
                setTextRows(textRows + 1);
            }
            setTextMessage(textMessage + '\n');
        }
    }   

    const textAreaKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key == 'Enter') {
            enterKeyDown.current = false;
        } else if (e.key == 'Shift') {
            shiftKeyDown.current = false;
        }
    }

    const textAreaBlur = () => {
        //setTextMessage(createTextLinks_(textMessage));
    }

    return (
        <div className="pool-view">
            {/* TODO: add fixed siaply of pool name along with # of active devices, # of active users, and # of users in general */}
            <div className="messages-container">
                <div className="pool-start-spacer">
                    <div className="pool-message-status">History End</div>
                </div>
                {
                    pool?.messages.map((msg, index) => (
                        <div className="pool-message" key={msg.msgID}>
                            <div className="pool-message-info-bar">
                                <div className="pool-message-name">
                                    {poolUsers.get(msg.src.userID)?.displayName}
                                </div>
                                <div className="pool-message-date">
                                    {new Date(msg.created).toLocaleTimeString('en-US')}
                                </div>
                            </div>
                            {
                                msg.type == PoolMessageType.TEXT ? (
                                    msg.data.split('\n').map((text: string, index: number) => (
                                        <div className="pool-message-text" key={index}>
                                            {text}
                                        </div>
                                    ))
                                ) : msg.type == PoolMessageType.FILE ? (
                                    <div className="">

                                    </div>
                                ) : undefined
                            }
                        </div>
                    ))
                }
                <div ref={messagesRef} className="pool-start-spacer" />
            </div>
            <div className="display-box">
                <textarea 
                    className="text-input" 
                    placeholder='Send Text Message' 
                    value={textMessage} 
                    ref={(e) => setTextAreaElement(e)}
                    onChange={textAreaChange} 
                    spellCheck="false" 
                    maxLength={5000} // make adjustable in pool creation setting
                    rows={textRows} 
                    onKeyDown={(e) => { if (e.key == 'Enter') e.preventDefault() }} 
                    onKeyDownCapture={textAreaKeyDown}
                    onKeyUpCapture={textAreaKeyUp}
                    onBlur={textAreaBlur}/>
            </div>
        </div>
    )
}