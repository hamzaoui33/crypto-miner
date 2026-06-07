/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

declare var Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export * from "@supabase/supabase-js";
}

declare module "https://esm.sh/crypto-js@4.2.0" {
  export * from "crypto-js";
}