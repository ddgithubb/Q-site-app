
export function StaticCenter(props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", margin: "40px" }}>
                { props.children }
            </div>
        </div>
    )
}