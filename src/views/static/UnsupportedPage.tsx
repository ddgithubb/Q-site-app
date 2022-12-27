import { StaticCenter } from "../components/StaticCenter";

export function UnsupportedPage() {
    return (
        <StaticCenter>
            <h1>Sorry! Your router/browser/device is not currently supported</h1>
            <h4>Note: Chrome and Microsoft Edge are recommended</h4>
        </StaticCenter>
    )
}