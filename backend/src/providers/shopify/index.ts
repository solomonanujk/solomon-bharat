import { ShopifyApiProvider } from './shopifyApiProvider';
import { ShopifyProvider } from './shopifyProvider.types';

// No mock variant — connection-time verification already gives a clear
// user-facing error if credentials are wrong, so there's nothing a mock would
// usefully stand in for locally (unlike PayPal/mail/storage, which are needed
// just to run the app at all without real credentials).
export const shopifyProvider: ShopifyProvider = new ShopifyApiProvider();
export * from './shopifyProvider.types';
