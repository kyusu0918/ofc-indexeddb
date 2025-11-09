# 🗂️ ofc-indexeddb

**Type-safe, zero-dependency IndexedDB wrapper for TypeScript**  
**with logical delete, async CRUD, and typed store factories.**  
by **Kei Yusu (Oresama Foundation Code)**

---

## 📦 Overview

`ofc-indexeddb` is a lightweight IndexedDB wrapper written in TypeScript,  
offering a unified, **type-safe**, and **promise-based** interface for database operations.  

It's part of the **Oresama Foundation Code (ofc)** series —  
focusing on practical utilities with consistent design, high readability,  
and zero external dependencies.

---

## ⚙️ Features

* ✅ **Type-safe CRUD operations** for IndexedDB.
* 🧩 **Promise-based async API**.
* 🧠 **Logical deletion** (soft delete with `is_delete` + timestamp).
* 🧱 **Schema factory** via `defineStore()` for reusable, typed shortcuts.
* 🧮 Built-in date (`now`) and ID auto-generation (`crypto.randomUUID`).
* 🔒 **Zero dependency**, minimal footprint.
* 🧪 **Fully covered by Jest tests** (96%+ line coverage).

---

## 💡 Why ofc-indexeddb?

> A next-generation IndexedDB wrapper for developers who demand both type-safety and simplicity.

Unlike most IndexedDB wrappers, **ofc-indexeddb is not just a Promise wrapper.**

It’s a fully **type-safe, functionally pure API** that lets you express **any filter logic** — including regex, date range, and complex predicates — directly in TypeScript. Traditional libraries often make you adapt to their APIs; **ofc-indexeddb lets you use JavaScript itself as your query language.**

---

## 🔍 Feature Comparison

| Feature | Dexie.js | idb | localforage | **ofc-indexeddb** |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript Support** | ⚠️ Partial | ❌ Minimal | ❌ None | ✅ **Full generics** |
| **Logical Delete Built-in** | ❌ | ❌ | ❌ | ✅ **Yes** |
| **Regex / Function Filters** | ❌ | ⚠️ Manual | ❌ | ✅ **Inline** (`(r) => /foo/.test(r.name)`) |
| **Proxy-safe (Vue/React)** | ❌ | ❌ | ❌ | ✅ `isProxy` option |
| **Pure Functional API** | ⚠️ Mixed | ✅ | ❌ | ✅ **100%** |
| **DB Creation Syntax** | Imperative | Native | Hidden | ✅ Declarative `createStore()` |
| **Dependencies** | Medium | Low | Medium | **Zero** |

---

## 🧠 Type-Safe by Design

All operations are typed at compile time. If you access an unknown property or mismatched type, **TypeScript catches it.**

```typescript
// ❌ Compile-time error (nonexistent field)
await Users.select(db, r => r.unknownField === 1);

// ✅ Valid, fully typed
await Users.select(db, r => /^[A-Z]/.test(r.name) && r.age >= 18);
```

This means `ofc-indexeddb` achieves practical type safety
that no other IndexedDB library has reached yet.

---

## 💬 Why It Matters

> Most IndexedDB wrappers wrap complexity. **ofc-indexeddb eliminates it — without losing type safety.**

You can think of it as:

> 🧩 “Dexie meets TypeScript generics and functional purity.”**

No custom query syntax. No hidden ORM layer.

Just **type-safe JavaScript** that works in any browser or Node environment.

---

## 🧪 Philosophy

> **“Simplicity is not the absence of power — it’s the absence of noise.”**

ofc-indexeddb is designed for developers who want **a predictable, zero-dependency, and composable way** to work with browser storage without magic or boilerplate.

---

## ⚡ Example Power Queries

```typescript
// Regex + logic combo
const results = await Users.select(db, r =>
    /^[AB]/.test(r.name) && r.age >= 18 && !r.is_delete
);

// Date range filtering
const recent = await Sessions.select(db, r =>
    new Date(r.timestamp) > new Date("2025-01-01")
);

// Complex logical filters
const activeTitles = await Titles.select(db, r =>
    !r.is_delete && /Project/i.test(r.title) && r.user_id === user.id
);
```

---
## 📘 Installation

```bash
npm install @kyusu0918/ofc-indexeddb
```

---

## 🚀 Usage Example

### 1️⃣ Define Data Models & Schema

All data models must extend `iofcRecBase` to inherit metadata fields (`id`, `inserted`, `updated`, `deleted`, `is_delete`).

```typescript
import ofcIndexedDB, { iofcRecBase } from '@kyusu0918/ofc-indexeddb';

// Define Data Model (must extend iofcRecBase)
interface iUser extends iofcRecBase {
  name: string;
  age: number;
}

// Define Schema Creation Function
export const createStoreV1 = (db: IDBDatabase) => {
  // Create 'users' store with 'id' as primary key
  const users = db.createObjectStore('users', { keyPath: 'id' });
  users.createIndex('name', 'name', { unique: false });
};
```

### 2️⃣ Recommended Usage: Type-Safe CRUD with Store Shortcuts

We use the `defineStore()` shortcut to eliminate repeated store names and enforce the logical delete default.

```typescript
// Open or create the DB (Version 1)
const db = await ofcIndexedDB.connect('AppDB', 1, createStoreV1);

// Define store shortcut and enable logical delete by default
const Users = ofcIndexedDB.defineStore<iUser>('users', {
    logicalDelete: true, // Users.delete() will default to soft delete
});

/**
 * 1️⃣ Insert a new user and get the generated ID
 * NOTE: Users.upsert() automatically generates ID, inserted, and updated timestamps.
 */
const newUserId = await Users.upsert(db, {
  name: 'Alice',
  age: 25,
} as iUser); // Use 'as iUser' since required base fields are auto-generated

/**
 * 2️⃣ Retrieve and Update the record
 * `updated` timestamp is automatically refreshed upon save.
 */
let user = await Users.get(db, newUserId);
user.age = 26;
await Users.upsert(db, user);

/**
 * 3️⃣ Filter (WHERE equivalent)
 * select() retrieves non-deleted records by default (due to defineStore setting).
 */
const adults = await Users.select(
  db,
  (r) => r.age >= 20 // Filters for users older than 20
);
console.log(adults);

/**
 * 4️⃣ Logical Delete (Soft Delete)
 * Marks a record as deleted (is_delete = true), updating `deleted` and `updated` timestamps.
 * The `logical: true` option is inherited from the Users shortcut definition.
 */
await Users.delete(db, newUserId);

/**
 * 5️⃣ Verify Logical Deletion
 */
const deletedUser = await Users.get(db, newUserId);
console.log(deletedUser.is_delete); // true
```

### 3️⃣ Unconstrained Query: The Power of select()

(This section is separated to keep the full CRUD flow clean, but demonstrates the true power)

```typescript
// Select only records where name starts with 'B'.
const activeUsers = await Users.select(db, (r) => r.name.startsWith('B'));

// Regex + logic combo: Complex search using Regex, age, and manual logical delete check
const results = await Users.select(db, r =>
    /^[AB]/.test(r.name) && r.age >= 18 && !r.is_delete
);
```

---

## 🧩 Core Methods: Native CRUD Example

For advanced users who prefer explicit control over store operations, the base methods remain fully accessible.

This example demonstrates the core functionality of `ofcIndexedDB` using native methods, showing how to handle data with explicit store names.

```typescript
// 1. Insert (Simple, typed call) - Explicitly pass the store name 'users'
const newUserId = await ofcIndexedDB.upsert<iUser>(db, 'users', {
    name: 'Bob',
    age: 33,
} as iUser);

// 2. Logical Delete - Must explicitly pass the logical option
await ofcIndexedDB.delete(db, 'users', newUserId, { logical: true });

// 3. Select (Filter) - Must explicitly exclude deleted records if logical delete was used
const activeUsers = await ofcIndexedDB.select<iUser>(db, 'users', (r) =>
    r.name.startsWith('B') && !r.is_delete
);
console.log(activeUsers);
```

---

## Error Handling
All CRUD methods return a Promise and throw `Error` objects when IndexedDB operations fail.
Always wrap calls in `try...catch` when necessary.

```typescript
try {
  const user = await ofcIndexedDB.get(db, "users", "001");
} catch (err) {
  console.error("Database error:", err);
}
```
> All methods throw native `Error` objects and never silently fail.
> You always get clear exception messages for easier debugging.

---

## 🧱 API Overview

| Method | Description | Example |
| :--- | :--- | :--- |
| `connect(name, version, createFunc)` | Opens or creates a DB. | `await connect('MyDB', 1, initFn)` |
| `get(db, store, key, index?)` | Retrieve one record by key or index. | `get(db, 'users', 'id-001')` |
| `list(db, store, index?, from?, to?)` | Retrieve multiple records by range. | `list(db, 'users')` |
| `select(db, store, whereFn, options?)` | Filter records by condition (WHERE equivalent). | `select(db, 'users', r => r.age > 30)` |
| `upsert(db, store, rec, options?)` | Insert or update record. | `upsert(db, 'users', rec)` |
| `delete(db, store, key, options?)` | Perform logical (soft) or physical delete. | `delete(db, 'users', id, { logical: true })` |
| `clear(db, store)` | Truncate all records from the store. | `clear(db, 'users')` |
| `defineStore(store, defaults?)` | **[Recommended]** Typed CRUD wrapper factory. | `const s = defineStore('users')` |

---

## 🧪 Testing

All tests are passing thanks to the recent fixes.

Run all tests (with Jest + fake-indexeddb):

```bash
npm test
```

Example result (indicating full functionality and high coverage):

```
 PASS  tests/ofcIndexedDB.test.ts
  Tests:        18 passed, 18 total

-----------------|---------|----------|---------|---------
File             | % Stmts | % Branch | % Funcs | % Lines
ofcIndexedDB.ts  |  86.02  |   79.16  |   69.23  |  96.39
```

---

## 📁 Project Structure

```
ofc-indexeddb/
├── src/
│   └── ofcIndexedDB.ts
├── tests/
│   └── ofcIndexedDB.test.ts
├── dist/
│   ├── ofcIndexedDB.js
│   ├── ofcIndexedDB.d.ts
│   └── ofcIndexedDB.js.map
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## 📘 Documentation

* [API Reference (English)](./docs/API.en.md)
* [APIリファレンス（日本語）](./docs/API.ja.md)

---

## 🔒 License

MIT © Kei Yusu  
Part of the **Oresama Foundation Code** series.

---

_“Typed. Simple. Persistent. — A new standard for type-safe browser storage.”_