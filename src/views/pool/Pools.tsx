import { useEffect } from "react";
import { isMobile } from "react-device-detect";
import { Outlet, useNavigate } from "react-router-dom";

export const DEFAULT_TEST_POOL_NAME: string = "main";

export function Pools() {

    const navigate = useNavigate();

    useEffect(() => {
        navigate("/pool/" + DEFAULT_TEST_POOL_NAME);
    }, [])

    return (
        <div>
        </div>
    )
}