import { buildServer } from "./server";
import { env } from "./config";
import { connectDb, ensureIndexes } from "./db";

async function main() {
  await connectDb();
  await ensureIndexes();

  const app = buildServer();
  // No Render/Heroku a porta é injetada (ex: 10000); é obrigatório escutar em 0.0.0.0
  const host = env.PORT === 4000 ? env.HOST : "0.0.0.0";
  await app.listen({ host, port: env.PORT });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

