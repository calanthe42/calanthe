import * as migration_20260906_222240_initial from './20260906_222240_initial';
import * as migration_20260906_232516_customer_identity from './20260906_232516_customer_identity';
import * as migration_20260907_013536_products_and_events from './20260907_013536_products_and_events';
import * as migration_20260907_021741_orders from './20260907_021741_orders';
import * as migration_20260907_030934_customer_management from './20260907_030934_customer_management';
import * as migration_20260907_031053_drop_legacy_address_columns from './20260907_031053_drop_legacy_address_columns';
import * as migration_20260907_033604_enquiries_and_memberships from './20260907_033604_enquiries_and_memberships';
import * as migration_20260907_071945_media_storage from './20260907_071945_media_storage';
import * as migration_20260907_202357_catalog_legacy_fields from './20260907_202357_catalog_legacy_fields';

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
    name: '20260907_013536_products_and_events',
  },
  {
    up: migration_20260907_021741_orders.up,
    down: migration_20260907_021741_orders.down,
    name: '20260907_021741_orders',
  },
  {
    up: migration_20260907_030934_customer_management.up,
    down: migration_20260907_030934_customer_management.down,
    name: '20260907_030934_customer_management',
  },
  {
    up: migration_20260907_031053_drop_legacy_address_columns.up,
    down: migration_20260907_031053_drop_legacy_address_columns.down,
    name: '20260907_031053_drop_legacy_address_columns',
  },
  {
    up: migration_20260907_033604_enquiries_and_memberships.up,
    down: migration_20260907_033604_enquiries_and_memberships.down,
    name: '20260907_033604_enquiries_and_memberships',
  },
  {
    up: migration_20260907_071945_media_storage.up,
    down: migration_20260907_071945_media_storage.down,
    name: '20260907_071945_media_storage',
  },
  {
    up: migration_20260907_202357_catalog_legacy_fields.up,
    down: migration_20260907_202357_catalog_legacy_fields.down,
    name: '20260907_202357_catalog_legacy_fields'
  },
];
