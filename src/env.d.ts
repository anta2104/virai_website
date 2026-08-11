/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Người dùng của session hiện tại, do middleware gán. */
    user: import('./lib/db/schema').User | null;
  }
}
