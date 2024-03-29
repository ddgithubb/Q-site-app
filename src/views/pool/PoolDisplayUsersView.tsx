import { memo, useRef, useState } from "react";
import { IndicatorDot } from "../components/IndicatorDot";

import AccordionArrowIcon from '../../assets/accordion-arrow.png';
import { PoolUserActiveDevices } from "./PoolView";
import { fileSizeToString } from "../../utils/file-size";

import BrowserIcon from '../../assets/browser.png';
import DesktopIcon from '../../assets/desktop.png';
import MobilePhoneIcon from '../../assets/mobile-phone.png';
import { PoolManager } from "../../pool/global";
import { DeviceType, PoolUserInfo } from "../../pool/sync_server.v1";


export interface PoolDisplayUsersViewParams {
    poolID: string
    users: PoolUserInfo[];
    userMap: Map<string, PoolUserActiveDevices>;
    hidden: boolean;
}

export const PoolDisplayUsersView = memo(PoolDisplayUsersViewComponent);

function PoolDisplayUsersViewComponent({ poolID, users, userMap, hidden }: PoolDisplayUsersViewParams) {

    const openAccordionUsersMap = useRef<Map<string, boolean>>(new Map<string, boolean>()).current;
    const [ accordionsOpened, setAccordionsOpened ] = useState<number>(0);

    const toggleAccordion = (userID: string) => {
        let opened = !(openAccordionUsersMap.get(userID));
        openAccordionUsersMap.set(userID, opened);
        setAccordionsOpened(accordionsOpened + (opened ? 1 : -1));
    }

    return (
        <div className="display-toggle-hide display-component-container display-users-container" aria-hidden={hidden}>
            {/* Use react virtualized (since it is a static set of data, define height and specifically specify height in DOM insetad of in CSS)*/}
            {
                users.map((user) => {
                    let userActiveDevices = userMap.get(user.userId);
                    return userActiveDevices ? (
                    // MAKE THE HEADER ACCORDION (with icon, only allow one accordion by just recording which current accordion)
                    <div className="display-user-accordion-container" key={user.userId}>
                        <div className="display-user-header elipsify-container" onClick={() => toggleAccordion(user.userId)}>
                            <img className="display-user-accordion-arrow" src={AccordionArrowIcon} aria-expanded={openAccordionUsersMap.get(user.userId)} />
                            <div className="display-user-display-name elipsify-content">{user.displayName}</div>
                            <div className="display-user-info-point elipsify-extra">
                                <IndicatorDot type={userActiveDevices.activeDevices ? "online" : "offline"} size="small" />
                                {userActiveDevices.activeDevices ? userActiveDevices.activeDevices.size + " Device" + (userActiveDevices.activeDevices.size > 1 ? "s" : "") + " Active" : " Offline"}
                            </div>
                        </div>
                        {/* <AnimatePresence> */}
                            {
                                openAccordionUsersMap.get(user.userId) && (
                                    // <motion.div initial={{ maxHeight: 0 }} animate={{ maxHeight: 400 }} exit={{ maxHeight: 0 }}>
                                        <div className="display-user-devices-container">
                                            {
                                                user.devices.slice().sort((a, b) => (userActiveDevices!.activeDevices!.has(a.deviceId) ? 0 : 1) - (userActiveDevices!.activeDevices!.has(b.deviceId) ? 0 : 1)).map((node) => (
                                                    <div className={"display-user-device-container " + "display-user-device-container" + (userActiveDevices?.activeDevices?.has(node.deviceId) ? "-online" : "-offline")} key={node.deviceId}>
                                                        {/* TODO: device type icon */}
                                                        <div className="display-user-device-header">
                                                            <img src={
                                                                node.deviceType == DeviceType.BROWSER ? BrowserIcon :
                                                                node.deviceType == DeviceType.DESKTOP ? DesktopIcon :
                                                                node.deviceType == DeviceType.MOBILE ? MobilePhoneIcon : BrowserIcon
                                                            } height="20" width="20" />
                                                            <span>{node.deviceName}</span>
                                                        </div>
                                                        {
                                                            userActiveDevices?.activeDevices?.get(node.deviceId)?.fileOffersInfo.map((fileInfo) => (
                                                                // PoolFileInfo type (change in model)
                                                                <div className="display-user-device-file-offer" key={fileInfo.fileId}>
                                                                    <span className="display-user-device-file-name" onClick={() => PoolManager.sendFileRequestToPool(poolID, fileInfo)}>{fileInfo.fileName}</span> 
                                                                    <span className="display-user-device-file-size">{fileSizeToString(fileInfo.totalSize)}</span>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    // </motion.div>
                                )
                            }
                        {/* </AnimatePresence> */}
                    </div>
                    // ACCORDION DEVICES + FILES
                ) : null})
            }
        </div>
    )
}