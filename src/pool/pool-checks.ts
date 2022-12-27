// MODIFIED from: https://github.com/tomchen/symmetric-nat-test/blob/main/src/isNormalNat.ts

function parseCandidate(line: string) {
    let parts;
    // Parse both constiants.
    if (line.indexOf("a=candidate:") === 0) {
        parts = line.substring(12).split(" ");
    } else {
        parts = line.substring(10).split(" ");
    }

    let relatedAddress: RTCIceCandidate["relatedAddress"] = null;
    let relatedPort: RTCIceCandidate["relatedPort"] = null;
    let tcpType: RTCIceCandidate["tcpType"] = null;

    for (let i = 8; i < parts.length; i += 2) {
        switch (parts[i]) {
            case "raddr":
                relatedAddress = parts[i + 1];
                break;
            case "rport":
                relatedPort = parseInt(parts[i + 1], 10);
                break;
            case "tcptype":
                tcpType = parts[i + 1] as "active" | "passive" | "so";
                break;
            default:
                // Unknown extensions are silently ignored.
                break;
        }
    }

    const candidate: Partial<RTCIceCandidate> & { ip: string } = {
        foundation: parts[0],
        component: parts[1] as "rtcp" | "rtp",
        protocol: parts[2].toLowerCase() as "tcp" | "udp",
        priority: parseInt(parts[3], 10),
        ip: parts[4],
        port: parseInt(parts[5], 10),
        // skip parts[6] == 'typ'
        type: parts[7] as "host" | "prflx" | "relay" | "srflx",
        relatedAddress,
        relatedPort,
        tcpType,
    };

    return candidate;
}

export const checkNAT = () =>
    new Promise<boolean>((resolve, reject) => {
        const candidates: Record<string, number[]> = {};
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
            ],
        });
        pc.createDataChannel("foo");
        console.log("Start checking NAT...")

        pc.onicecandidate = function (e) {
            //console.log("onicecandidate:", e.candidate);
            if (pc.iceGatheringState == 'complete') {
                if (Object.keys(candidates).length === 1) {
                    const ports = candidates[Object.keys(candidates)[0]];
                    console.log("NAT check result:", ports.length === 1);
                    resolve(ports.length === 1);
                    return;
                }
                console.log("No ice candidates");
                resolve(false);
                return;
            } else if (e.candidate && e.candidate.candidate.indexOf("srflx") !== -1)  {
                const cand = parseCandidate(e.candidate.candidate);
                console.log("Got candidate:", e.candidate);
                const { relatedPort, port } = cand;
                if (relatedPort !== null && relatedPort !== undefined) {
                    if (!candidates[relatedPort]) {
                        candidates[relatedPort] = [];
                    }
                    if (port !== null && port !== undefined) {
                        candidates[relatedPort].push(port);
                    }
                }
            }
        };

        pc.createOffer().then((offer) => pc.setLocalDescription(offer));
    });