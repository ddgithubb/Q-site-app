import { useEffect } from "react";
import { StaticCenter } from "../components/StaticCenter";

export function MaintenancePage() {
    return (
        <StaticCenter>
            <h1>Servers are currently under maintenance</h1>
            <h3>Come back in a few minutes!</h3>
        </StaticCenter>
    )
}