import hmacSHA256 from 'crypto-js/hmac-sha256';
import Base64 from 'crypto-js/enc-base64';
import { AuthUser } from '../types/AuthUser';
import { publicAxiosClient as publicClient } from '../utils/axios';

function getGETHeaders(user: AuthUser): { 'X-YB-API-Key': string } {
    return {
        'X-YB-API-Key': user?.apiKey,
    };
}

type AuthenticationMethod = 'nonce' | 'timestamp';

function getPOSTHeaders(
    user: AuthUser,
    data: unknown,
    authenticationMethod: AuthenticationMethod = 'timestamp'
): {
    'X-YB-API-Key': string;
    'X-YB-Nonce'?: string;
    'X-YB-Timestamp'?: string;
    'X-YB-Sign': string;
} {
    if (authenticationMethod === 'timestamp') {
        return getPOSTHeadersWithTimestamp(user, data);
    } else {
        return getPOSTHeadersWithNonce(user, data);
    }
}

function getPOSTHeadersWithNonce(
    user: AuthUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
): {
    'X-YB-API-Key': string;
    'X-YB-Nonce': string;
    'X-YB-Sign': string;
} {
    const nonce = new Date().getTime().toString(); // Milliseconds since epoch

    return {
        'X-YB-Nonce': nonce,
        'X-YB-API-Key': user?.apiKey,
        'X-YB-Sign': getHMACDigest(
            user?.signingToken || user.password!,
            `Content=${JSON.stringify(data)}
Nonce=${nonce}`
        ),
    };
}

function getPOSTHeadersWithTimestamp(
    user: AuthUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
): {
    'X-YB-API-Key': string;
    'X-YB-Timestamp': string;
    'X-YB-Sign': string;
} {
    const timestampInMicroseconds = new Date().getTime() * 1000; // Microseconds since epoch

    return {
        'X-YB-Timestamp': timestampInMicroseconds.toString(),
        'X-YB-API-Key': user?.apiKey,
        'X-YB-Sign': getHMACDigest(
            user?.signingToken || user.password!,
            `Content=${JSON.stringify(data)}
Timestamp=${timestampInMicroseconds}`
        ),
    };
}

function getDELETEHeaders(
    user: AuthUser,
    authenticationMethod: AuthenticationMethod = 'timestamp'
): {
    'X-YB-API-Key': string;
    'X-YB-Nonce'?: string;
    'X-YB-Timestamp'?: string;
    'X-YB-Sign': string;
} {
    if (authenticationMethod === 'timestamp') {
        return getDELETEHeadersWithTimestamp(user);
    } else {
        return getDELETEHeadersWithNonce(user);
    }
}

function getDELETEHeadersWithTimestamp(user: AuthUser): {
    'X-YB-API-Key': string;
    'X-YB-Timestamp': string;
    'X-YB-Sign': string;
} {
    const timestampInMicroseconds = new Date().getTime() * 1000; // Microseconds since epoch

    return {
        'X-YB-Timestamp': timestampInMicroseconds.toString(),
        'X-YB-API-Key': user?.apiKey,
        'X-YB-Sign': getHMACDigest(
            user?.signingToken || user.password!,
            `Content=
Timestamp=${timestampInMicroseconds}`
        ),
    };
}

function getDELETEHeadersWithNonce(user: AuthUser): {
    'X-YB-API-Key': string;
    'X-YB-Nonce': string;
    'X-YB-Sign': string;
} {
    const nonce = new Date().getTime().toString(); // Milliseconds since epoch

    return {
        'X-YB-Nonce': nonce,
        'X-YB-API-Key': user?.apiKey,
        'X-YB-Sign': getHMACDigest(
            user?.signingToken || user.password!,
            `Content=
Nonce=${nonce}`
        ),
    };
}

function getHMACDigest(secret: string, body: string): string {
    const hash = hmacSHA256(body, secret);
    const base64 = Base64.stringify(hash);
    return toBase64Url(base64);
}

const toBase64Url = (str: string) => str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

/**
 * Execute authenticated POST/PUT request with body.
 * @param requestOptions - Extra options forwarded verbatim to the SDK call (e.g. throwOnError, __ignoreStatusCodes).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAuthenticatedRequest<T = any>(
    user: AuthUser,
    sdkFunction: Function,
    body: unknown,
    extraHeaders?: Record<string, string>,
    requestOptions?: Record<string, unknown>
): Promise<T | undefined> {
    const authHeaders = extraHeaders
        ? { ...getPOSTHeaders(user, body, 'timestamp'), ...extraHeaders }
        : getPOSTHeaders(user, body, 'timestamp');
    const response = await sdkFunction({
        client: publicClient,
        headers: authHeaders,
        body,
        ...requestOptions,
    });
    return response?.data;
}

/**
 * Execute authenticated GET request.
 * @param requestOptions - Extra options forwarded verbatim to the SDK call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAuthenticatedGet<T = any>(
    user: AuthUser,
    sdkFunction: Function,
    extraHeaders?: Record<string, string>,
    requestOptions?: Record<string, unknown>
): Promise<T | undefined> {
    const headers = extraHeaders ? { ...getGETHeaders(user), ...extraHeaders } : getGETHeaders(user);
    const response = await sdkFunction({
        client: publicClient,
        headers,
        ...requestOptions,
    });
    return response?.data;
}

/**
 * Execute authenticated request with path parameters (for DELETE requests).
 * @param requestOptions - Extra options forwarded verbatim to the SDK call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAuthenticatedDeleteWithPath<T = any>(
    user: AuthUser,
    sdkFunction: Function,
    path: Record<string, string>,
    requestOptions?: Record<string, unknown>
): Promise<T | undefined> {
    const authHeaders = getDELETEHeaders(user);
    const response = await sdkFunction({
        client: publicClient,
        headers: authHeaders,
        path,
        ...requestOptions,
    });
    return response?.data;
}

export {
    getGETHeaders,
    getPOSTHeaders,
    getDELETEHeaders,
    executeAuthenticatedRequest,
    executeAuthenticatedGet,
    executeAuthenticatedDeleteWithPath,
};
