import { useEffect, useRef } from "react";
import { httpGetOptions, SYNC_SERVER_API_GET_VERSION_ENDPOINT, SYNC_SERVER_VERSION } from "../../config/http";
import { StaticCenter } from "../components/StaticCenter";

interface SyncServerVersionData {
    Version: string;
}

export function validateSSState() {
    let atMaintenance = window.location.pathname == '/maintenance';
    let atHome = window.location.pathname == '/';
    fetch(SYNC_SERVER_API_GET_VERSION_ENDPOINT, httpGetOptions())
        .then(async (res) => {
            let jsonRes: SyncServerVersionData = await res.json();
            console.log("VERSION", jsonRes.Version);
            if (jsonRes.Version == SYNC_SERVER_VERSION) {
                if (atMaintenance) {
                    window.location.href = '/';
                }
            } else {
                if (!atHome) {
                    window.location.pathname = '/';
                }
            }
        }).catch((e) => {
            if (!atMaintenance) {
                window.location.href = "/maintenance";
            }
        })
}

export function MaintenancePage() {

    useEffect(() => {
        setInterval(() => {
            validateSSState();
        }, 5000);
    }, []);

    return (
        <StaticCenter>
            <h1>Servers are currently under maintenance</h1>
            <h3>Come back in a few minutes!</h3>
        </StaticCenter>
    )
}