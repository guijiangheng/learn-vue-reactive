import { queueJob } from "./job-queue.mjs";
import { activeEffect, pop, push } from "./effect-scope.mjs";

export const RAW_SYMBOL = Symbol("RAW");
export const ITERATE_KEY = Symbol("ITERATE");

export const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

const bucket = new WeakMap();

export let shouldTrack = true;

export const track = (target, key) => {
  if (!activeEffect || !shouldTrack) return;

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

export const trigger = (target, key, type, newValue) => {
  const depsMap = bucket.get(target);

  if (!depsMap) return;

  const effectsToRun = new Set();

  const addEffectsByKey = (key) => {
    const effects = depsMap.get(key);
    effects &&
      effects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  };

  addEffectsByKey(key);

  if (Array.isArray(target)) {
    if (type === TriggerType.ADD) {
      addEffectsByKey("length");
    } else if (key === "length") {
      depsMap.forEach((_, key) => {
        if (key !== "length" && key >= newValue) {
          addEffectsByKey(key);
        }
      });
    }
  }

  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    addEffectsByKey(ITERATE_KEY);
  }

  effectsToRun.forEach((effect) => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect);
    } else {
      queueJob(effect);
    }
  });
};

const isEqual = (a, b) => a === b || (isNaN(a) && isNaN(b));

const arrayInstrumentations = {};

[("includes", "indexOf", "lastIndexOf")].forEach((key) => {
  const method = Array.prototype[key];

  arrayInstrumentations[key] = function () {
    let result = method.apply(this, arguments);

    if (!result || result.length === -1) {
      return method.apply(this[RAW_SYMBOL], arguments);
    }

    return result;
  };
});

["push", "pop", "unshift", "shift", "splice"].forEach((key) => {
  const method = Array.prototype[key];

  arrayInstrumentations[key] = function () {
    shouldTrack = false;
    let result = method.apply(this, arguments);
    shouldTrack = true;

    return result;
  };
});

export const createReactive = (obj, isShallow = false, isReadOnly = false) => {
  return new Proxy(obj, {
    has(target, key) {
      if (!isReadOnly) {
        track(target, key);
      }

      return Reflect.has(target, key);
    },

    ownKeys(target) {
      if (!isReadOnly) {
        track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      }

      return Reflect.ownKeys(target);
    },

    get(target, key, receiver) {
      if (key === RAW_SYMBOL) return target;

      if (
        Array.isArray(target) &&
        Object.prototype.hasOwnProperty.call(arrayInstrumentations, key)
      ) {
        return Reflect.get(arrayInstrumentations, key);
      }

      if (!isReadOnly && typeof key !== "symbol") {
        track(target, key);
      }

      const result = Reflect.get(target, key, receiver);

      if (isShallow || typeof result !== "object" || result === null)
        return result;

      return isReadOnly ? readonly(result) : reactive(result);
    },

    set(target, key, newValue, receiver) {
      if (isReadOnly) {
        console.warn(`attribute ${key} is readonly`);
        return true;
      }

      const oldValue = Reflect.get(target, key, receiver);
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const result = Reflect.set(target, key, newValue, receiver);

      if (target === receiver[RAW_SYMBOL] && !isEqual(oldValue, newValue)) {
        trigger(target, key, type, newValue);
      }

      return result;
    },

    deleteProperty(target, key) {
      if (isReadOnly) {
        console.warn(`attribute ${key} is readonly`);
        return true;
      }

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

const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();

const factory = (cache) => (createProxy) => (obj) => {
  const existEntry = cache.get(obj);

  if (existEntry) return existEntry;

  const newEntry = createProxy(obj);

  cache.set(obj, newEntry);

  return newEntry;
};

export const reactive = factory(reactiveMap)(createReactive);

export const readonly = factory(readonlyMap)((obj) =>
  createReactive(obj, false, true)
);

export const shallowReactive = factory(shallowReactiveMap)((obj) =>
  createReactive(obj, true, false)
);

export const shallowReadonly = factory(shallowReadonlyMap)((obj) =>
  createReactive(obj, true, true)
);
