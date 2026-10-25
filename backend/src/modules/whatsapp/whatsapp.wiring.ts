import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { whatsAppProvider } from '../../providers/whatsapp';
import { storageProvider } from '../../providers/storage';
import { categoriesService } from '../categories/categories.service';
import { getGeminiApiKey } from '../guide/guide.ai';
import { productsService } from '../products/products.service';
import { bulkMessagesService } from '../bulk-messages/bulk-messages.service';
import { GeminiListingExtractor } from './whatsapp.ai';
import { flattenLeaves } from './whatsapp.category';
import { ProductsPort, WhatsAppConversation } from './whatsapp.conversation';
import { CategoryOption } from './whatsapp.listing';
import { DEFAULT_FLOW_CONFIG, MediaFetcher, ProductCreator, WhatsAppListingFlow } from './whatsapp.listing.flow';
import { WhatsAppLinkingRepository } from './whatsapp.linking.repository';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppSessionRepository } from './whatsapp.session.repository';

/** Builds the production object graph. Kept apart so unit tests never load the products module. */
const repo = new WhatsAppRepository();

const LEAVES_TTL_MS = 10 * 60 * 1000;
let leavesCache: { at: number; leaves: CategoryOption[] } | null = null;

const flow: WhatsAppListingFlow = new WhatsAppListingFlow(
  new WhatsAppSessionRepository(),
  new GeminiListingExtractor(getGeminiApiKey),
  // The service is created below; the closure only runs once a message arrives.
  { fetch: (media): ReturnType<MediaFetcher['fetch']> => whatsAppService.fetchMedia(media) },
  storageProvider,
  {
    async leaves() {
      if (!leavesCache || Date.now() - leavesCache.at > LEAVES_TTL_MS) {
        leavesCache = { at: Date.now(), leaves: flattenLeaves(await categoriesService.getPublicTree()) };
      }
      return leavesCache.leaves;
    },
  },
  productsService as unknown as ProductCreator,
  (to, body) =>
    whatsAppProvider.sendText(to, body).catch((err) => {
      logger.error({ err }, '[whatsapp] reply could not be sent');
    }),
  {
    ...DEFAULT_FLOW_CONFIG,
    aiEnabled: env.WHATSAPP_AI_ENABLED !== 'false',
    dailyCap: env.WHATSAPP_AI_DAILY_CAP,
  },
);

const conversation: WhatsAppConversation = new WhatsAppConversation(
  new WhatsAppLinkingRepository(),
  productsService as unknown as ProductsPort,
  repo,
  whatsAppProvider,
  `${env.APP_URL.replace(/\/$/, '')}/portal/settings`,
  flow,
  bulkMessagesService,
);

export const whatsAppService: WhatsAppService = new WhatsAppService(repo, whatsAppProvider, conversation, bulkMessagesService);
