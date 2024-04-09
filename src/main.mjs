import { reactive, watch } from "./lib.mjs";

const obj = reactive({ value: 1 });

watch(
  () => obj.value,
  (value, old) => {
    console.log(value, old);
  },
  { immediate: true, flush: "post" }
);

setTimeout(() => {
  obj.value += 1;
  obj.value += 1;
}, 1000);
