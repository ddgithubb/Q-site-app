
export type AppType = 'site' | 'desktop';

export const APP_TYPE: AppType = 'site';

export const PRODUCTION_MODE: boolean = process.env.NODE_ENV === 'production';