{ pkgs, ... }:

{
  # Node.js 22 LTS — Next.js, Prisma, npm
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
  };

  packages = [ pkgs.git ];

  # Naložimo .env (DATABASE_URL)
  dotenv.enable = true;

  env.DATABASE_URL = "file:./dev.db";

  # Na NixOS Prisma zazna platformo "linux-nixos", uradnih binarnikov zanjo ni (404).
  # Zato prisilimo cilj debian-openssl-3.0.x — binarniki tečejo prek nix-ld
  # (libssl.so.3, libstdc++.so.6 so v /run/current-system/sw/share/nix-ld/lib).
  env.PRISMA_CLI_BINARY_TARGETS = "debian-openssl-3.0.x";
  env.PRISMA_QUERY_ENGINE_BINARY = "./node_modules/@prisma/engines/query-engine-debian-openssl-3.0.x";
  env.PRISMA_QUERY_ENGINE_LIBRARY = "./node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node";
  env.PRISMA_SCHEMA_ENGINE_BINARY = "./node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x";
  env.PRISMA_INTROSPECTION_ENGINE_BINARY = "./node_modules/@prisma/engines/introspection-engine-debian-openssl-3.0.x";
  env.PRISMA_FMT_BINARY = "./node_modules/@prisma/engines/prisma-fmt-debian-openssl-3.0.x";

  enterShell = ''
    echo "AdaHack2026 devenv — node $(node --version), npm $(npm --version)"
  '';
}
