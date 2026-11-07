import { validateProductionEnvironment } from "./production-config.mjs";

const errors = validateProductionEnvironment(process.env);
if (errors.length > 0) {
  console.error("Production configuration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production configuration check passed. No secret values were displayed.");
}
