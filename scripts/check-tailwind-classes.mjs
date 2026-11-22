// Fails when src/ uses a class Tailwind does not generate. Run by `npm run lint`.
import { fileURLToPath } from "node:url";
import { findUnknownClasses } from "./tailwind-classes.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const unknown = await findUnknownClasses(`${root}src`, `${root}src/app/globals.css`);
if (unknown.size > 0) {
  console.error(
    "Classes Tailwind does not generate (define the token in globals.css @theme/@utility or fix the name):",
  );
  for (const [cls, files] of unknown) console.error(`  ${cls}  <- ${files.join(", ")}`);
  process.exit(1);
}
