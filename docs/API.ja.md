# 📘 APIリファレンス（日本語）

`ofc-indexeddb` は、TypeScript向けに型安全と非同期処理（Promiseベース）を提供し、ロジカルデリートを標準搭載したIndexedDBラッパーです。

---

## 🗂️ ベースインターフェース

データベースに格納するすべてのデータモデルは、以下のメタデータを持つ **`OfcRec`** インターフェースを継承する必要があります。

```typescript
export interface OfcRec {
  id: string;       // レコードの一意なID (crypto.randomUUIDで自動生成)
  inserted: string; // 挿入日時 (ISO 8601形式で自動生成)
  updated: string;  // 更新日時 (ISO 8601形式で自動更新)
  deleted: string;  // 削除日時 (論理削除時に設定)
  is_delete: boolean; // 削除フラグ (true: 論理削除済み)
}
```

---

## 🧱 ofcIndexedDB オブジェクト

ライブラリのすべての機能は、静的オブジェクト **`ofcIndexedDB`** を通じて提供されます。

### 1. 接続・管理系メソッド

| メソッド名 | 概要 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- |
| **`connect`** | データベースへの接続（または新規作成）を行います。Promiseベースの非同期関数です。 | `name?`: DB名<br>`version?`: バージョン<br>`createFunc?`: スキーマ作成関数 (`onupgradeneeded` で実行) | `Promise<IDBDatabase>` |
| **`createStore`** | オブジェクトストア作成関数を実行します。`connect`内の`onupgradeneeded`での使用を想定。 | `db`: DBオブジェクト<br>`createFunc`: ストア作成関数 | `void` |
| **`drop`** | データベース全体を削除します。 | `name?`: 削除するDB名 | `Promise<boolean>` (成功時 `true`) |
| **`clear`** | 指定されたオブジェクトストア内の全レコードを削除（TRUNCATE）します。 | `db`: DBオブジェクト<br>`store`: ストア名 | `Promise<boolean>` (成功時 `true`) |

```typescript
// 接続例
const db = await ofcIndexedDB.connect(
  'AppDB',
  1,
  (db) => {
    // スキーマ定義
    db.createObjectStore('users', { keyPath: 'id' }).createIndex('name', 'name');
  }
);
```

---

### 2. CRUD（データ操作）メソッド

| メソッド名 | 概要 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- |
| **`upsert<T>`** | レコードの挿入または更新（IDが存在しない場合は挿入、存在する場合は更新）を行います。 | `db`: DBオブジェクト<br>`store`: ストア名<br>`rec`: 挿入/更新レコード（`OfcRec`を継承）<br>`options?`: ID/日時生成関数、Proxy解除フラグなど | `Promise<string>` (レコードID) |
| **`get<T>`** | IDまたはインデックスキーを使用して単一のレコードを取得します。 | `db`: DBオブジェクト<br>`store`: ストア名<br>`key`: 検索キー（IDまたはインデックスキー）<br>`index?`: 使用するインデックス名 | `Promise<T>` (見つからない場合は `{}` を返却) |
| **`list<T>`** | 範囲（Range）を指定して複数のレコードを配列として取得します。 | `db`: DBオブジェクト<br>`store`: ストア名<br>`index?`: 使用するインデックス名<br>`from?`: 範囲の開始キー<br>`to?`: 範囲の終了キー | `Promise<T[]>` |
| **`select<T>`** | 条件関数（`where`）を使用して、レコードをフィルタリング（WHERE句相当）して取得します。 | `db`: DBオブジェクト<br>`store`: ストア名<br>`where`: 条件関数 (`(record: T) => boolean`)<br>`options.includeDeleted?`: 論理削除済みレコードを含めるか | `Promise<T[]>` |
| **`count`** | 指定されたオブジェクトストア内のレコード数を取得します。 | `db`: DBオブジェクト<br>`store`: ストア名 | `Promise<number>` |
| **`delete`** | レコードを削除します。オプションで**論理削除**（`is_delete = true` に設定）が可能です。 | `db`: DBオブジェクト<br>`store`: ストア名<br>`key`: 削除対象のID<br>`options.logical?`: `true`で論理削除、`false`/省略で物理削除 | `Promise<boolean>` (成功時 `true`) |

---

### 3. ストア定義ショートカット

| メソッド名 | 概要 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- |
| **`defineStore<T>`** | 特定のストア名に対して型付けされたCRUD操作メソッド群を生成します。これにより、各メソッドでストア名を指定する必要がなくなります。 | `store`: ストア名<br>`defaults?`: デフォルトのID/日時生成関数、論理削除設定など | **型付けされた操作オブジェクト** (ex: `Titles.get(db, key)`) |

#### `defineStore` で生成されるメソッド

`defineStore<T>('storeName')` が返すオブジェクトには、以下の型安全なメソッドが含まれます。

* `list(db, index?, from?, to?)`
* `select(db, where?)`
* `get(db, key, index?)`
* `count(db)`
* `upsert(db, rec, isProxy?)`
* `delete(db, key)` ※ `defaults.logicalDelete` の設定に従う
* `clear(db)`

```typescript
// 使用例（型安全なショートカット）
// Tはレコードの型
const Users = ofcIndexedDB.defineStore<iUser>('users', {
  logicalDelete: true, // このストアではデフォルトで論理削除を使用
});

// 以降、ストア名 'users' の指定が不要に
const user = await Users.get(db, 'user-id-001');
await Users.delete(db, 'user-id-001'); // 論理削除が実行される
```

---

### 4. bindStore<T> — 事前バインド型ストアAPI（`推奨`）

`defineStore` と類似していますが、指定した DB インスタンスを自動的にバインドするため、
**すべての呼び出し**で `db` **引数が不要** になります。

| メソッド名 | 説明 | 戻り値 |
| :--- | :--- | :--- |
| **`bindStore<T>(db, store, defaults?)`** | 指定した DB にバインド済みの型安全な CRUD 操作群を生成。 | 型安全な CRUD オブジェクト |

* `list(index?, from?, to?)`
* `select(where?)`
* `get(key, index?)`
* `count(db)`
* `upsert(rec, isProxy?)`
* `delete(key)` *Behavior follows `defaults.logicalDelete` setting.*
* `clear(db)`
```typescript
// 例：事前バインド型ストア
const db = await ofcIndexedDB.connect('AppDB', 1, createStoreV1);
const Users = ofcIndexedDB.bindStore<iUser>(db, 'users');

// db を渡さずにメソッドを呼び出せる
await Users.upsert({ name: 'Alice', age: 25, city: 'Tokyo' });
const list = await Users.select(r => !r.is_delete);
await Users.delete('user-id-001');

// 事前バインドストアによる、型安全で直感的なクエリの例
const db = await ofcIndexedDB.connect('AppDB', 1, createStoreV1);
const Users = ofcIndexedDB.bindStore<iUser>(db, 'users');

// レコード挿入
await Users.upsert({ name: 'Alice', age: 25, city: 'Tokyo' });
await Users.upsert({ name: 'Bob', age: 30, city: 'Osaka' });
await Users.upsert({ name: 'Charlie', age: 28, city: 'Tokyo' });

// ✅ select() の威力
const tokyoUsers = await Users.select(r => r.city === 'Tokyo' && !r.is_delete);
console.log(tokyoUsers.map(u => u.name));
// → ["Alice", "Charlie"]

// db を指定せずに論理削除も可能
await Users.delete(tokyoUsers[0].id);
```
