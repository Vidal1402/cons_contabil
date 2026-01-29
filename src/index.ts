import { buildServer } from "./server";
import { env } from "./config";

async function main() {
  const app = buildServer();
  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

