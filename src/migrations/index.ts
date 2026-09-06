import * as migration_20260906_222240_initial from './20260906_222240_initial';
import * as migration_20260906_232516_customer_identity from './20260906_232516_customer_identity';

export const migrations = [
  {
    up: migration_20260906_222240_initial.up,
    down: migration_20260906_222240_initial.down,
    name: '20260906_222240_initial',
  },
  {
    up: migration_20260906_232516_customer_identity.up,
    down: migration_20260906_232516_customer_identity.down,
    name: '20260906_232516_customer_identity'
  },
];
