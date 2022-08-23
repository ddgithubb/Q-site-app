import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

export function Pools() {

    const navigate = useNavigate();

    useEffect(() => {
        navigate("/pool/main");
    }, [])

    return (
        <div>
            <Outlet />
        </div>
    )
}