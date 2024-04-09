import { p } from "./consts.mjs";

let isFlushing = false;
const jobQueue = new Set();

export const flushJob = () => {
  if (isFlushing) return;

  isFlushing = true;

  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    isFlushing = false;
  });
};

export const queueJob = (job) => {
  jobQueue.add(job);
  flushJob();
};
