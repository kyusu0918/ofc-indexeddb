# ⚛️ React & Vue 3 統合ガイド

> **ofc-indexeddb** を React と Vue 3 に統合する方法
— 完全な型安全性・リアクティブ性・最小限の記述で実現。

---

## 🧩 概要

`ofc-indexeddb` はフレームワークに依存しない設計で、
ブラウザ上のデータをローカルのリアクティブストアのように簡単に扱うことができます。

このライブラリの中核となるのは `bindStore()` です。
IndexedDB のストアを CRUD メソッド付きの便利なオブジェクトにバインドし、
ID・タイムスタンプ・論理削除（soft delete）を自動的に処理します。

---

## ⚛️ React — カスタムフックパターン

### 1️⃣ モデルとスキーマを定義する

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

### 2️⃣ `bindStore()` を使用してフックを作成する
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

### 3️⃣ コンポーネントで使用する
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
✅ UI は追加や削除のたびに自動的に更新されます。
`bindStore()` により、IndexedDB の複雑な処理をすべて隠蔽しつつ、完全な型安全性を保ちます。

## 🟢 Vue 3 — Composition API パターン

### 1️⃣ モデルとスキーマを定義する
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

### 2️⃣ `bindStore()` を使用してリアクティブなストアを作成
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

### 3️⃣ コンポーネントで使用する
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
✅ Vue のリアクティビティにより、IndexedDB の変更が即座に UI に反映されます。

---
## ⚙️ ベストプラクティス（v1.0.0）
| 項目 | 推奨内容 |
|-------|----------------|
| **アプリごとに1つの接続** | `connect()` は起動時に1回呼び出し、DB インスタンスを再利用する。 |
| **`bindStore()` の利用** | CRUD 呼び出しを簡略化し、db 引数を手動で渡す必要をなくす。 |
| **ソフト削除（論理削除）** | `{ logicalDelete: true }` を設定すると、`is_delete` フラグと削除時刻が自動更新される。 |
| **タイムスタンプ自動更新** | `upsert()` は常に `updated` フィールドを最新化する。 |
| **リアクティブ更新** | 更新後は `select()` を呼び出してコンポーネント状態を再同期する。 |

---

## 📘 まとめ
>`ofc-indexeddb` は IndexedDB をフレームワークフレンドリーなリアクティブデータ層に変換します。
型安全で宣言的、そしてボイラープレートのない開発を実現します。

`bindStore()` を使えば、
React と Vue 3 の両方でブラウザ永続データをシームレスに扱うことができます。

---

## 🔗 関連ドキュメント

- [**API リファレンス（日本語）**](./API.ja.md) — メソッドや型の詳細ドキュメント。  
- [**プロジェクト概要（README）**](../README.md) — 概要、インストール方法、機能比較。  
- [**GitHub リポジトリ**](https://github.com/kyusu0918/ofc-indexeddb) — ソースコード、Issue、リリース履歴。
