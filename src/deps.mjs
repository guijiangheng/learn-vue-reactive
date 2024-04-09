import { activeEffect } from "./effect-scope.mjs";
import { queueJob } from "./job-queue.mjs";

export const RAW_SYMBOL = Symbol("RAW");
export const ITERATE_KEY = Symbol("ITERATE");

export const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

const bucket = new WeakMap();

export const track = (target, key) => {
  if (!activeEffect) return;

  let depsMap = bucket.get(target);

  if (!depsMap) {
    depsMap = new Map();
    bucket.set(target, depsMap);
  }

  let deps = depsMap.get(key);

  if (!deps) {
    deps = new Set();
    depsMap.set(key, deps);
  }

  deps.add(activeEffect);
  activeEffect.deps.push(deps);
};

export const trigger = (target, key, type) => {
  const depsMap = bucket.get(target);

  if (!depsMap) return;

  const effectFnsToRun = new Set();

  const effectFns = depsMap.get(key);

  effectFns &&
    effectFns.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectFnsToRun.add(effectFn);
      }
    });

  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    const iterateEffectFns = depsMap.get(ITERATE_KEY);

    iterateEffectFns &&
      iterateEffectFns.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectFnsToRun.add(effectFn);
        }
      });
  }

  effectFnsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      queueJob(effectFn);
    }
  });
};
