import { reactive, watch } from "./lib.mjs";

const obj = reactive([]);

watch(
  () => obj.length,
  () => {
    console.log(obj);
  }
);

setTimeout(() => {
  obj.push(1);
}, 1000);

setTimeout(() => {
  obj.push(1);
}, 2000);
