import { JobFatal, type JobHandler } from "../types";

/** Implémenté dans une phase ultérieure. */
export const mindmapHandler: JobHandler = {
  async run() {
    throw new JobFatal("Fonction pas encore disponible.");
  },
};
