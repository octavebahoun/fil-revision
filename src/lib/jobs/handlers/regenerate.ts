import { JobFatal, type JobHandler } from "../types";

/** Implémenté dans une phase ultérieure. */
export const regenerateCardHandler: JobHandler = {
  async run() {
    throw new JobFatal("Fonction pas encore disponible.");
  },
};
