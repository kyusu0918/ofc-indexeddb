// tests/setup.ts

// Jest の jsdom 環境で structuredClone が undefined の場合はモックする
if (typeof global.structuredClone === "undefined") {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}
