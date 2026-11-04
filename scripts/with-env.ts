/**
 * Lance une commande avec un fichier d'environnement en priorité.
 * Usage : tsx scripts/with-env.ts .env.localstack -- next start
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const sep = process.argv.indexOf("--");
const files = process.argv.slice(2, sep);
const cmd = process.argv.slice(sep + 1);
const env = { ...process.env };
for (const f of files) Object.assign(env, parse(readFileSync(f, "utf8")));
const child = spawn(cmd[0]!, cmd.slice(1), { stdio: "inherit", env, shell: false });
child.on("exit", (code) => process.exit(code ?? 1));
