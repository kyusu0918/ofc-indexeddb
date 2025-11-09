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

### 2️⃣ Connect and Perform Basic CRUD

```typescript
// Open or create the DB (Version 1)
const db = await ofcIndexedDB.connect('AppDB', 1, createStoreV1);

/**
 * 1️⃣ Insert a new user and get the generated ID
 *  * NOTE: ofcIndexedDB.upsert() automatically generates ID, inserted, and updated timestamps.
 * Only custom fields are required for the initial insertion object.
 */
const newUserId = await ofcIndexedDB.upsert<iUser>(db, 'users', {
  name: 'Alice',
  age: 25,
} as iUser); // Use 'as iUser' to satisfy TS since required base fields are auto-generated

/**
 * 2️⃣ Retrieve and Update the record
 *  * `updated` timestamp is automatically refreshed upon save.
 */
const user = await ofcIndexedDB.get<iUser>(db, 'users', newUserId);
user.age = 26;
await ofcIndexedDB.upsert<iUser>(db, 'users', user);

/**
 * 3️⃣ Filter (WHERE equivalent)
 *  * `select()` retrieves non-deleted records by default.
 */
const adults = await ofcIndexedDB.select<iUser>(
  db,
  'users',
  (r) => r.age >= 20 // Filters for users older than 20
);
console.log(adults);

/**
 * 4️⃣ Logical Delete (Soft Delete)
 *  * Marks a record as deleted (is_delete = true), updating `deleted` and `updated` timestamps.
 */
await ofcIndexedDB.delete(db, 'users', newUserId, { logical: true });

/**
 * 5️⃣ Verify Logical Deletion
 */
const deletedUser = await ofcIndexedDB.get<iUser>(db, 'users', newUserId);
console.log(deletedUser.is_delete); // true
```

---

## 🧩 Define Store Shortcuts (Recommended)

Use `defineStore()` to create reusable, type-safe handlers for a specific store, eliminating the need to pass the store name repeatedly.

```typescript
// Define store shortcut for 'users'
const Users = ofcIndexedDB.defineStore<iUser>('users', {
  logicalDelete: true, // Default to logical delete for this store
});

// 1. Insert (Simple, typed call)
const newUserId = await Users.upsert(db, { name: 'Bob', age: 33 } as iUser);

// 2. Logical Delete (Uses store default: logical=true)
await Users.delete(db, newUserId);

// 3. Select (Automatically excludes logically deleted records)
const activeUsers = await Users.select(db, (r) => r.name.startsWith('B'));
console.log(activeUsers);
```

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
## 📁 Project Structure
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

_“Typed. Simple. Persistent. — A new standard for browser storage.”_