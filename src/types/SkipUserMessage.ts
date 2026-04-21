export interface SkipUserMessage {
    // Keep the underscores to make it very specific as we pass that additional information in request bodies for some special cases
    __ignoreStatusCodes?: number[];
    __ignoreNetworkErrors?: boolean;
}
