import { NodeConnection, Pool } from "../models/Pool.model";
import { NodeStatusData, Report, ReportNodeData, SDPData, Status, WSMessage } from "../models/SyncServerWS.model";
import { SendWSMessage } from "./ConnectPool.service";

function InitializeRTCPeerConnection(): RTCPeerConnection {
    return new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]})
}

function InitializeMainDataChannel(connection: RTCPeerConnection, ws: WebSocket): RTCDataChannel {
    let dc = connection.createDataChannel("main", {
        ordered: true,
        negotiated: true,
    });

    dc.onmessage = (e) => {
        console.log("DC message RECV", e);
    };

    dc.onclose = (e) => {
        SendWSMessage(ws, 2006, <ReportNodeData>{ ReportCode: Report.DISCONNECT_REPORT });
    }

    return dc;
}

export function SendOffer(pool: Pool, wsMsg: WSMessage) {
    if (pool.nodeConnections.has(wsMsg.TargetNodeID)) {
        CloseNodeConnection(pool.nodeConnections.get(wsMsg.TargetNodeID)!);
        pool.nodeConnections.delete(wsMsg.TargetNodeID);
    }

    let connection = InitializeRTCPeerConnection();
    let dataChannel = InitializeMainDataChannel(connection, pool.wsConn);

    connection.onicegatheringstatechange = () => {
        if (connection.iceGatheringState != 'complete') {
            return
        }
        SendWSMessage(pool.wsConn, 2003, <SDPData>{ SDP: JSON.stringify(connection.localDescription), Status: Status.SUCCESSFUL }, wsMsg);
    }

    connection.createOffer().then(
        (d) => connection.setLocalDescription(d), 
        () => SendWSMessage(pool.wsConn, 2003, <SDPData>{ SDP: "", Status: Status.UNSUCCESSFUL }, wsMsg
    ));

    let nodeConnection: NodeConnection = {
        connection: connection,
        dataChannel: dataChannel,
    };

    pool.nodeConnections.set(wsMsg.TargetNodeID, nodeConnection);
}

export function AnswerOffer(pool: Pool, wsMsg: WSMessage) {
    if (pool.nodeConnections.has(wsMsg.TargetNodeID)) {
        CloseNodeConnection(pool.nodeConnections.get(wsMsg.TargetNodeID)!);
        pool.nodeConnections.delete(wsMsg.TargetNodeID);
    }

    let connection = InitializeRTCPeerConnection();
    let dataChannel = InitializeMainDataChannel(connection, pool.wsConn);

    let sdpData: SDPData = wsMsg.Data;

    connection.onicegatheringstatechange = () => {
        if (connection.iceGatheringState != 'complete') {
            return
        }
        SendWSMessage(pool.wsConn, 2004, <SDPData>{ SDP: JSON.stringify(connection.localDescription), Status: Status.SUCCESSFUL }, wsMsg);
    }

    connection.setRemoteDescription(JSON.parse(sdpData.SDP)).then(() => connection.createAnswer().then(
        (d) => connection.setLocalDescription(d), 
        () => SendWSMessage(pool.wsConn, 2004, <SDPData>{ SDP: "", Status: Status.UNSUCCESSFUL }, wsMsg)
    ), () => SendWSMessage(pool.wsConn, 2004, <SDPData>{ SDP: "", Status: Status.UNSUCCESSFUL }, wsMsg));

    let nodeConnection: NodeConnection = {
        connection: connection,
        dataChannel: dataChannel,
    };

    pool.nodeConnections.set(wsMsg.TargetNodeID, nodeConnection);
}

export function ConnectNode(pool: Pool, wsMsg: WSMessage) {

    let nodeConnection = pool.nodeConnections.get(wsMsg.TargetNodeID);

    if (!nodeConnection || nodeConnection?.connection.connectionState != 'new') {
        SendWSMessage(pool.wsConn, 2001, <NodeStatusData>{ Status: Status.UNSUCCESSFUL }, wsMsg);
        return;
    }

    let sdpData: SDPData = wsMsg.Data;

    nodeConnection.dataChannel.onopen = (e) => {
        SendWSMessage(pool.wsConn, 2001, <NodeStatusData>{ Status: Status.SUCCESSFUL }, wsMsg);
    }

    nodeConnection.connection.setRemoteDescription(JSON.parse(sdpData.SDP)).then(null , 
        () => SendWSMessage(pool.wsConn, 2001, <NodeStatusData>{ Status: Status.UNSUCCESSFUL }, wsMsg)
    );
}

export function CloseNodeConnection(nodeConnection: NodeConnection) {
    nodeConnection.connection.close();
    nodeConnection.dataChannel?.close();
}