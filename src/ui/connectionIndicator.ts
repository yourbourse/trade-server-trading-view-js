import type { TradeServerClient } from '../trade-server-api/TradeServerClient.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ prefix: '[ConnectionIndicator]' });

export function initConnectionIndicator(client: TradeServerClient): () => void {
    const el = document.getElementById('connection-status');
    if (!el) {
        logger.warn('connection-status element not found');
        return () => {};
    }

    const dot = document.createElement('span');
    dot.className = 'connection-dot';
    const label = document.createElement('span');
    label.className = 'connection-label';
    el.appendChild(dot);
    el.appendChild(label);

    function setState(state: 'connected' | 'reconnecting' | 'disconnected' | 'degraded', detail?: string): void {
        el!.dataset['state'] = state;
        switch (state) {
            case 'connected':
                label.textContent = 'Live';
                el!.title = 'Connected';
                break;
            case 'reconnecting':
                label.textContent = detail ?? 'Reconnecting…';
                el!.title = 'Reconnecting…';
                break;
            case 'disconnected':
                label.textContent = 'Disconnected';
                el!.title = 'Disconnected';
                break;
            case 'degraded':
                label.textContent = 'Server is live, but no data is arriving';
                el!.title = 'Subscriptions failed — check your account permissions';
                break;
        }
    }

    // Start in connected state (called after connect() succeeds)
    setState('connected');

    const dispose = client.onConnectionStateChange((state) => {
        if (state !== 'reconnecting') {
            setState(state);
        }
        // 'reconnecting' is handled by the direct subscription below (has attempt count)
    });

    // Also subscribe directly to reconnecting event to get attempt count
    const subs = client.websocket.getSubscriptions();
    const onReconnecting = (data: unknown) => {
        const d = data as { attempt?: number; max?: number };
        const detail = d.attempt !== undefined && d.max !== undefined
            ? `Reconnecting… (${d.attempt}/${d.max})`
            : 'Reconnecting…';
        setState('reconnecting', detail);
    };
    subs.subscribe('reconnecting', onReconnecting);

    return () => {
        dispose();
        subs.unsubscribe('reconnecting', onReconnecting);
    };
}
