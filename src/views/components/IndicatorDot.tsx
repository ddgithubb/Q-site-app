import './IndicatorDot.css'

export type IndicatorDotType = 'offline' | 'online' | 'danger';
export type IndicatorDotSize = 'small' | 'medium' | 'large';

export interface IndicatorDotParams {
    type: IndicatorDotType;
    size?: IndicatorDotSize;
}

export function IndicatorDot({ type, size }: IndicatorDotParams) {
    return <div className={"dot " + type + "-dot " + (size || "medium") + "-dot"} />
}