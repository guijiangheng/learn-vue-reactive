import {
  ITERATE_KEY,
  RAW_SYMBOL,
  TriggerType,
  track,
  trigger,
} from "./deps.mjs";
import { pop, push } from "./effect-scope.mjs";

const isEqual = (a, b) => a === b || (isNaN(a) && isNaN(b));

export const createReactive = (obj, isShallow = false) => {
  return new Proxy(obj, {
    has(target, key) {
      track(target, key);

      return Reflect.has(target, key);
    },

    ownKeys(target) {
      track(target, ITERATE_KEY);

      return Reflect.ownKeys(target);
    },

    get(target, key, receiver) {
      if (key === RAW_SYMBOL) return target;

      track(target, key);

      const result = Reflect.get(target, key, receiver);

      if (isShallow || typeof result !== "object" || result === null)
        return result;

      return createReactive(result, true);
    },

    set(target, key, newValue, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const isOwnProperty = Object.prototype.hasOwnProperty.call(target, key);
      const type = isOwnProperty ? "SET" : "ADD";
      const result = Reflect.set(target, key, newValue, receiver);

      if (target === receiver[RAW_SYMBOL] && !isEqual(oldValue, newValue)) {
        trigger(target, key, type);
      }

      return result;
    },

    deleteProperty(target, key) {
      const isOwnProperty = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);

      if (result && isOwnProperty) {
        trigger(target, key, TriggerType.DELETE);
      }

      return result;
    },
  });
};

export const effect = (fn, options) => {
  const cleanup = () => {
    effectFn.deps.forEach((deps) => {
      deps.delete(effectFn);
    });
    effectFn.deps.length = 0;
  };

  const effectFn = () => {
    cleanup(effectFn);
    push(effectFn);
    const result = fn();
    pop();
    return result;
  };

  effectFn.options = options;
  effectFn.deps = [];

  if (!options.lazy) {
    effectFn();
  }

  return effectFn;
};
