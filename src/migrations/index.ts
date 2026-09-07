import * as migration_20260906_222240_initial from './20260906_222240_initial';
import * as migration_20260906_232516_customer_identity from './20260906_232516_customer_identity';
import * as migration_20260907_013536_products_and_events from './20260907_013536_products_and_events';

export const migrations = [
  {
    up: migration_20260906_222240_initial.up,
    down: migration_20260906_222240_initial.down,
    name: '20260906_222240_initial',
  },
  {
    up: migration_20260906_232516_customer_identity.up,
    down: migration_20260906_232516_customer_identity.down,
    name: '20260906_232516_customer_identity',
  },
  {
    up: migration_20260907_013536_products_and_events.up,
    down: migration_20260907_013536_products_and_events.down,
    name: '20260907_013536_products_and_events'
  },
];
