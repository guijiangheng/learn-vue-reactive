let activeEffect;
const effectStack = [];

export const push = (effectFn) => {
  activeEffect = effectFn;
  effectStack.push(effectFn);
};

export const pop = () => {
  effectStack.pop();
  activeEffect = effectStack[effectStack.length - 1];
};

export { activeEffect };
