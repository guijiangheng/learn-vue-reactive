let activeEffect;
const effectStack = [];

export const push = (effect) => {
  activeEffect = effect;
  effectStack.push(effect);
};

export const pop = () => {
  effectStack.pop();
  activeEffect = effectStack[effectStack.length - 1];
};

export { activeEffect };
