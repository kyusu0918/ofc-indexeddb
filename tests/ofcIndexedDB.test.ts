// tests/ofcIndexedDB.complete.test.ts
// ---------------------------------------------------------
// ✅ Complete test suite for ofcIndexedDB (full + extra coverage)
// ---------------------------------------------------------
import 'fake-indexeddb/auto';
import ofcIndexedDB, { iofcRec } from '../src/ofcIndexedDB';

// ---------------------------------------------------------
// Test Model
// ---------------------------------------------------------
interface iUser extends iofcRec {
  name: string;
  age: number;
  city: string;
}

const DB_NAME = 'TestDB';
const STORE = 'users';
const NOW = () => '2025-11-10T12:00:00Z';
const LATER = () => '2025-11-10T12:05:00Z';

const createUserStore = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains(STORE)) {
    const store = db.createObjectStore(STORE, { keyPath: 'id' });
    store.createIndex('city', 'city', { unique: false });
  }
};

// ---------------------------------------------------------
// Main suite (core functions)
// ---------------------------------------------------------
describe('ofcIndexedDB - Full Function Coverage', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await ofcIndexedDB.drop(DB_NAME).catch(() => {});
    db = await ofcIndexedDB.connect(DB_NAME, 1, createUserStore);
  });

  afterEach(() => db.close());

  // -------------------------------------------------------
  // connect and drop
  // -------------------------------------------------------
  test('connect and drop', async () => {
    expect(db.name).toBe(DB_NAME);
    expect(Array.from(db.objectStoreNames)).toContain(STORE);

    db.close();
    const dropped = await ofcIndexedDB.drop(DB_NAME);
    expect(dropped).toBe(true);

    const newDb = await ofcIndexedDB.connect(DB_NAME, 1, createUserStore);
    expect(newDb.name).toBe(DB_NAME);
    newDb.close();
  });

  // -------------------------------------------------------
  // upsert / get
  // -------------------------------------------------------
  test('upsert inserts new record with metadata', async () => {
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE, {
      name: 'Alice', age: 30, city: 'Tokyo'
    }, { now: NOW });

    const rec = await ofcIndexedDB.get<iUser>(db, STORE, id);
    expect(rec.id).toBeDefined();
    expect(rec.name).toBe('Alice');
    expect(rec.inserted).toBe(NOW());
    expect(rec.updated).toBe(NOW());
    expect(rec.is_delete).toBe(false);
  });

  test('upsert performs partial update (merge behavior)', async () => {
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE, {
      name: 'Bob', age: 20, city: 'Osaka'
    }, { now: NOW });

    await ofcIndexedDB.upsert<iUser>(db, STORE, { id, city: 'Kyoto' }, { now: LATER });
    const rec = await ofcIndexedDB.get<iUser>(db, STORE, id);
    expect(rec.name).toBe('Bob');
    expect(rec.city).toBe('Kyoto');
    expect(rec.updated).toBe(LATER());
  });

  // -------------------------------------------------------
  // list / count / select
  // -------------------------------------------------------
  test('list and count return all records', async () => {
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'C', age: 10, city: 'Tokyo' });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'D', age: 20, city: 'Osaka' });
    const list = await ofcIndexedDB.list<iUser>(db, STORE);
    const count = await ofcIndexedDB.count(db, STORE);
    expect(list.length).toBe(count);
    expect(list.length).toBeGreaterThan(0);
  });

  test('select filters correctly and respects is_delete flag', async () => {
    await ofcIndexedDB.upsert<iUser>(db, STORE,
      { name: 'X', age: 10, city: 'Tokyo' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE,
      { name: 'Y', age: 20, city: 'Tokyo', is_delete: true }, { now: NOW });

    const active = await ofcIndexedDB.select<iUser>(db, STORE, r => r.city === 'Tokyo');
    expect(active.every(r => !r.is_delete)).toBe(true);

    const all = await ofcIndexedDB.select<iUser>(db, STORE, r => r.city === 'Tokyo', { includeDeleted: true });
    expect(all.some(r => r.is_delete)).toBe(true);
  });

  // -------------------------------------------------------
  // delete
  // -------------------------------------------------------
  test('delete performs physical delete', async () => {
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE, {
      name: 'DelPhys', age: 40, city: 'Nagoya'
    });
    expect(await ofcIndexedDB.count(db, STORE)).toBeGreaterThan(0);

    const ok = await ofcIndexedDB.delete(db, STORE, id, { logical: false });
    expect(ok).toBe(true);

    const rec = await ofcIndexedDB.get<iUser>(db, STORE, id);
    expect(rec).toEqual({});
  });

  test('delete performs logical delete', async () => {
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE, {
      name: 'DelLogic', age: 50, city: 'Kobe'
    }, { now: NOW });
    const ok = await ofcIndexedDB.delete(db, STORE, id, { logical: true, now: LATER });
    expect(ok).toBe(true);

    const rec = await ofcIndexedDB.get<iUser>(db, STORE, id);
    expect(rec.is_delete).toBe(true);
    expect(rec.deleted).toBe(LATER());
  });

  // -------------------------------------------------------
  // defineStore / bindStore
  // -------------------------------------------------------
  test('defineStore provides type-safe store API', async () => {
    const UserStore = ofcIndexedDB.defineStore<iUser>(STORE, { logicalDelete: true, now: NOW });
    const id = await UserStore.upsert(db, { name: 'DefUser', age: 18, city: 'Yokohama' });
    const rec = await UserStore.get(db, id);
    expect(rec.name).toBe('DefUser');
    await UserStore.delete(db, id); // logical delete
    const list = await UserStore.select(db, r => r.city === 'Yokohama');
    expect(list.length).toBe(0);
  });

  test('bindStore auto-binds db and methods work without explicit db argument', async () => {
    const Bound = ofcIndexedDB.bindStore<iUser>(db, STORE);
    const id = await Bound.upsert({ name: 'Bound', age: 22, city: 'Kyoto' });
    const rec = await Bound.get(id);
    expect(rec.city).toBe('Kyoto');
    const list = await Bound.list();
    expect(list.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------
  // Error handling & edge cases
  // -------------------------------------------------------
  test('get returns {} for non-existent id', async () => {
    const rec = await ofcIndexedDB.get<iUser>(db, STORE, 'unknown');
    expect(rec).toEqual({});
  });

  test('delete should resolve true even if key does not exist', async () => {
    const result = await ofcIndexedDB.delete(db, STORE, '');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------
// Extra Coverage (error & branch)
// ---------------------------------------------------------
describe('ofcIndexedDB - Extra Coverage', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await ofcIndexedDB.drop(DB_NAME).catch(() => {});
    db = await ofcIndexedDB.connect(DB_NAME, 1, createUserStore);
  });

  afterEach(() => db.close());

  test('connect should reject when opening with lower version (mocked)', async () => {
    const spy = jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('VersionError');
    });
    await expect(ofcIndexedDB.connect(DB_NAME, 1, createUserStore)).rejects.toThrow('VersionError');
    spy.mockRestore();
  });

  test('drop should reject when deletion fails internally (safe mock)', async () => {
    const spy = jest.spyOn(indexedDB, 'deleteDatabase').mockImplementation(() => {
      throw new Error('Simulated internal error');
    });
    await expect(ofcIndexedDB.drop(DB_NAME)).rejects.toThrow('Simulated internal error');
    spy.mockRestore();
  });

  test('get should work using an index key', async () => {
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE, {
      name: 'IndexTest', age: 25, city: 'Sapporo',
    });
    const rec = await ofcIndexedDB.get<iUser>(db, STORE, 'Sapporo', 'city');
    expect(rec.name).toBe('IndexTest');
  });

  test('delete should reject if transaction throws', async () => {
    const txSpy = jest
      .spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementation(() => { throw new Error('Transaction fail'); });
    await expect(ofcIndexedDB.delete(db, STORE, 'xxx')).rejects.toThrow('Transaction fail');
    txSpy.mockRestore();
  });

  test('defineStore should respect logicalDelete=false', async () => {
    const UserStore = ofcIndexedDB.defineStore<iUser>(STORE, { logicalDelete: false, now: NOW });
    const id = await UserStore.upsert(db, { name: 'PhysUser', age: 42, city: 'Hiroshima' });
    const ok = await UserStore.delete(db, id);
    expect(ok).toBe(true);
    const rec = await UserStore.get(db, id);
    expect(rec).toEqual({});
  });

  test('bindStore should work correctly with logicalDelete=false', async () => {
    const Bound = ofcIndexedDB.bindStore<iUser>(db, STORE, { logicalDelete: false });
    const id = await Bound.upsert({ name: 'BoundExtra', age: 33, city: 'Fukuoka' });
    const rec = await Bound.get(id);
    expect(rec.city).toBe('Fukuoka');
    const ok = await Bound.delete(id);
    expect(ok).toBe(true);
  });
});

// -------------------------------------------------------
// Extra: list() index range / count error / clear() success & error
// -------------------------------------------------------
describe('ofcIndexedDB - Additional branch coverage', () => {
  let db: IDBDatabase;
  const NOW = () => '2025-11-10T14:00:00Z';
  const DB_NAME2 = 'TestDB_ListRange_Count_Clear';
  const STORE = 'users';

  interface iUser extends iofcRec {
    name: string;
    age: number;
    city: string;
  }

  const createUserStore = (db: IDBDatabase) => {
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('city', 'city', { unique: false });
      store.createIndex('age', 'age', { unique: false }); // ついでに別indexも
    }
  };

  beforeEach(async () => {
    await ofcIndexedDB.drop(DB_NAME2).catch(() => {});
    db = await ofcIndexedDB.connect(DB_NAME2, 1, createUserStore);
  });

  afterEach(() => db.close());

  test('list() with index and from/to range (openCursor path)', async () => {
    // Tokyo (A..Z のレンジテスト用に city をバラす)
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'A1', age: 20, city: 'Nagoya' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'A2', age: 21, city: 'Osaka' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'A3', age: 22, city: 'Sapporo' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'A4', age: 23, city: 'Tokyo' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'A5', age: 24, city: 'Yokohama' }, { now: NOW });

    // city のインデックスで from/to 範囲を指定して抽出
    // 例： 'Osaka' 以上 'Tokyo' 以下 → Osaka, Sapporo, Tokyo が対象
    const ranged = await ofcIndexedDB.list<iUser>(db, STORE, 'city', 'Osaka', 'Tokyo');
    const names = ranged.map(r => r.name).sort();
    expect(names).toEqual(['A2', 'A3', 'A4']); // Osaka / Sapporo / Tokyo
  });

  test('count() should reject if transaction throws (error branch)', async () => {
    const spy = jest
      .spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementation(() => { throw new Error('tx error in count'); });
    await expect(ofcIndexedDB.count(db, STORE)).rejects.toThrow('tx error in count');
    spy.mockRestore();
  });

  test('clear() should remove all records (success path)', async () => {
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'C1', age: 30, city: 'Kyoto' }, { now: NOW });
    await ofcIndexedDB.upsert<iUser>(db, STORE, { name: 'C2', age: 31, city: 'Kyoto' }, { now: NOW });
    expect(await ofcIndexedDB.count(db, STORE)).toBe(2);

    const ok = await ofcIndexedDB.clear(db, STORE);
    expect(ok).toBe(true);
    expect(await ofcIndexedDB.count(db, STORE)).toBe(0);
  });

  test('clear() should reject if transaction throws (error branch)', async () => {
    const spy = jest
      .spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementation(() => { throw new Error('tx error in clear'); });
    await expect(ofcIndexedDB.clear(db, STORE)).rejects.toThrow('tx error in clear');
    spy.mockRestore();
  });
});

// -------------------------------------------------------
// bindStore - Full API coverage
// -------------------------------------------------------
describe('ofcIndexedDB - bindStore full API coverage', () => {
  let db: IDBDatabase;
  const DB_NAME = 'TestDB_BindStore_Full';
  const STORE = 'users';
  const NOW = () => '2025-11-10T15:00:00Z';
  const LATER = () => '2025-11-10T15:05:00Z';

  interface iUser extends iofcRec {
    name: string;
    age: number;
    city: string;
  }

  const createUserStore = (db: IDBDatabase) => {
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('city', 'city', { unique: false });
    }
  };

  beforeEach(async () => {
    await ofcIndexedDB.drop(DB_NAME).catch(() => {});
    db = await ofcIndexedDB.connect(DB_NAME, 1, createUserStore);
  });

  afterEach(() => db.close());

  test('bindStore all methods work correctly', async () => {
    const Bound = ofcIndexedDB.bindStore<iUser>(db, STORE, {
      now: NOW,
      logicalDelete: true,
    });

    // --- 1️⃣ upsert (insert)
    const id = await Bound.upsert({ name: 'BoundUser', age: 20, city: 'Tokyo' });
    const rec1 = await Bound.get(id);
    expect(rec1.name).toBe('BoundUser');
    expect(rec1.inserted).toBe(NOW());

    // --- 2️⃣ upsert (partial update) — 同じNOW()なのでupdatedは変わらなくてもOK
    await Bound.upsert({ id, city: 'Osaka' }, false);
    const rec2 = await Bound.get(id);
    expect(rec2.name).toBe('BoundUser'); // 保持される
    expect(rec2.city).toBe('Osaka'); // 更新される
    expect(rec2.updated).toBeDefined(); // 値は存在すればOK

    // --- 3️⃣ select (default: exclude deleted)
    const resultsActive = await Bound.select(r => r.city === 'Osaka');
    expect(resultsActive.length).toBe(1);

    // --- 4️⃣ count
    const count = await Bound.count();
    expect(count).toBe(1);

    // --- 5️⃣ delete (logical delete)
    const ok = await Bound.delete(id);
    expect(ok).toBe(true);
    const deletedRec = await Bound.get(id);
    expect(deletedRec.is_delete).toBe(true);

    // --- 6️⃣ select (includeDeleted)
    const resultsAll = await ofcIndexedDB.select<iUser>(db, STORE, r => r.city === 'Osaka', { includeDeleted: true });
    expect(resultsAll.some(r => r.is_delete)).toBe(true);

    // --- 7️⃣ clear
    const cleared = await Bound.clear();
    expect(cleared).toBe(true);
    expect(await Bound.count()).toBe(0);
  });
});
