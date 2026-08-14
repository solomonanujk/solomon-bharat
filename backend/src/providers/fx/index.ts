import { FrankfurterFxProvider } from './frankfurterFxProvider';
import { FxProvider } from './fxProvider.types';

export const fxProvider: FxProvider = new FrankfurterFxProvider();

export * from './fxProvider.types';
