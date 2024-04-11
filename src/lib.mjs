import { p } from "./consts.mjs";
import { createReactive, effect } from "./core.mjs";
import { track, trigger } from "./deps.mjs";

export const reactive = (obj) => createReactive(obj);
export const readonly = (obj) => createReactive(obj, true, true);
export const shallowReactive = (obj) => createReactive(obj, true);
export const shallowReadonly = (obj) => createReactive(obj, true, true);

const traverse = (value, seen = new Set()) => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;

  seen.add(value);

  for (const k in value) {
    traverse(value[k], seen);
  }

  return value;
};

export const computed = (getter) => {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    },
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }

      track(obj, "value");

      return value;
    },
  };

  return obj;
};

export const watch = (source, cb, options = {}) => {
  let getter = typeof source === "function" ? source : () => traverse(source);

  let cleanup;

  const onInvalidate = (fn) => {
    cleanup = fn;
  };

  let newValue;
  let oldValue;

  const job = () => {
    newValue = effectFn();

    if (cleanup) {
      cleanup();
    }

    cb(newValue, oldValue, onInvalidate);
    oldValue = newValue;
  };

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (options.flush === "post") {
        p.then(job);
      } else {
        job();
      }
    },
  });

  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
};
