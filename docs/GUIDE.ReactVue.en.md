# ⚛️ React & Vue 3 Integration Guide

> How to integrate **ofc-indexeddb** with React and Vue 3 — fully type-safe, reactive, and minimal.

---

## 🧩 Overview

`ofc-indexeddb` is framework-agnostic and provides a simple way to manage browser data as if it were a local reactive store.

The key concept is **`bindStore()`** —  
it binds an IndexedDB store to a convenient object with CRUD methods that automatically handle IDs, timestamps, and logical deletes.

---

## ⚛️ React — Custom Hook Pattern

### 1️⃣ Define the model and schema

```ts
// useUsersStore.ts
import { useEffect, useState } from "react";
import ofcIndexedDB, { OfcRec, OfcBoundStore } from "@kyusu0918/ofc-indexeddb";

interface iUser extends OfcRec {
  name: string;
  age: number;
}

const createStoreV1 = (db: IDBDatabase) => {
  const users = db.createObjectStore("users", { keyPath: "id" });
  users.createIndex("name", "name", { unique: false });
};
```

### 2️⃣ Create a Hook using `bindStore()`
```ts
export function useUsersStore() {
  const [users, setUsers] = useState<iUser[]>([]);
  const [store, setStore] = useState<OfcBoundStore<iUser> | null>(null);

  useEffect(() => {
    (async () => {
      const db = await ofcIndexedDB.connect("AppDB", 1, createStoreV1);
      const bound = ofcIndexedDB.bindStore<iUser>(db, "users", {
        logicalDelete: true, // enable soft delete (is_delete flag)
      });
      setStore(bound);
      setUsers(await bound.select());
    })();
  }, []);

  async function add(user: Omit<iUser, keyof OfcRec>) {
    if (!store) return;
    await store.upsert(user as iUser); // ID and timestamps auto-managed
    setUsers(await store.select());
  }

  async function remove(id: string) {
    if (!store) return;
    await store.delete(id); // soft delete when logicalDelete=true
    setUsers(await store.select());
  }

  return { users, add, remove };
}
```

### 3️⃣ Use it in your component
```ts
// UserList.tsx
import { useUsersStore } from "./useUsersStore";

export function UserList() {
  const { users, add, remove } = useUsersStore();

  return (
    <div>
      <h3>Users</h3>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name} ({u.age})
            <button onClick={() => remove(u.id)}>🗑</button>
          </li>
        ))}
      </ul>
      <button onClick={() => add({ name: "New User", age: 20 })}>➕ Add</button>
    </div>
  );
}
```
✅ The UI automatically updates after every insert or delete.
bindStore() hides all IndexedDB boilerplate while preserving full type safety.

## 🟢 Vue 3 — Composition API Pattern

### 1️⃣ Define the model and schema
```ts
// useUsersStore.ts
import { ref, onMounted } from "vue";
import ofcIndexedDB, { OfcRec, OfcBoundStore } from "@kyusu0918/ofc-indexeddb";

interface iUser extends OfcRec {
  name: string;
  age: number;
}

const createStoreV1 = (db: IDBDatabase) => {
  const users = db.createObjectStore("users", { keyPath: "id" });
  users.createIndex("name", "name", { unique: false });
};
```

### 2️⃣ Create a reactive store with `bindStore()`
```ts
export function useUsersStore() {
  const users = ref<iUser[]>([]);
  let store: OfcBoundStore<iUser> | null = null;

  onMounted(async () => {
    const db = await ofcIndexedDB.connect("AppDB", 1, createStoreV1);
    store = ofcIndexedDB.bindStore<iUser>(db, "users", { logicalDelete: true });
    users.value = await store.select();
  });

  async function add(user: Omit<iUser, keyof OfcRec>) {
    if (!store) return;
    await store.upsert(user as iUser);
    users.value = await store.select();
  }

  async function remove(id: string) {
    if (!store) return;
    await store.delete(id);
    users.value = await store.select();
  }

  return { users, add, remove };
}
```

## 🔹`isProxy` （optional, default: false）

>If `true`, the given object is treated as a Vue Proxy or reactive reference, and will be safely unwrapped before being stored in IndexedDB.
Useful when using Vue's `ref()` or `reactive()` directly.

```ts
// Vue で Proxy オブジェクトを直接渡す場合のみ true
await store.upsert(users.value[0], true);
```

### 3️⃣ Use it in your component
```ts
<!-- UserList.vue -->
<template>
  <div>
    <h3>Users</h3>
    <ul>
      <li v-for="u in users" :key="u.id">
        {{ u.name }} ({{ u.age }})
        <button @click="remove(u.id)">🗑</button>
      </li>
    </ul>
    <button @click="add({ name: 'New User', age: 20 })">➕ Add</button>
  </div>
</template>

<script setup lang="ts">
import { useUsersStore } from "./useUsersStore";
const { users, add, remove } = useUsersStore();
</script>
```
✅ Vue’s reactivity ensures automatic UI updates when IndexedDB data changes.

---
## ⚙️ Best Practices
| Topic | Recommendation |
|-------|----------------|
| **Single connection per app** | Call `connect()` once at startup and reuse the DB instance. |
| **Use `bindStore()`** | Simplifies CRUD calls — no need to pass the DB object manually. |
| **Soft delete** | Set `{ logicalDelete: true }` to enable `is_delete` flag and timestamp updates. |
| **Automatic timestamps** | `upsert()` always refreshes the `updated` field for every operation. |
| **Reactive refresh** | After each mutation, call `select()` to update your component state. |

---

## 📘 Summary
>**ofc-indexeddb** turns IndexedDB into a framework-friendly, reactive data layer
>— fully typed, declarative, and boilerplate-free.

With `bindStore()`, you can manage persistent browser data seamlessly
in both **React** and **Vue 3** applications.

---

## 🔗 Related Documents

- [**API Reference (English)**](./API.en.md) — Detailed method and type documentation.  
- [**Project Overview (README)**](../README.md) — Overview, installation, and feature comparison.  
- [**GitHub Repository**](https://github.com/kyusu0918/ofc-indexeddb) — Source code, issues, and release history.  
