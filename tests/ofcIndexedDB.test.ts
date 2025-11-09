import 'fake-indexeddb/auto';
import ofcIndexedDB, { iofcRecBase } from '../src/ofcIndexedDB'; // Adjust the actual path

// --- Mock Utilities and Data ---
// DB Name (Uses a timestamp for uniqueness per test run)
const TEST_DB_NAME = 'TestDB_ofc'; 

// Test Data Interface
interface iUser extends iofcRecBase {
  name: string;
  age: number;
}

// Test Object Store Definition Function (onupgradeneeded equivalent)
const createStore = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains('users')) {
    const store = db.createObjectStore('users', { keyPath: 'id' });
    store.createIndex('name', 'name', { unique: false });
    store.createIndex('age', 'age', { unique: false });
  }
};

// Mock Functions
const mockId = (n: number) => `mock-id-${String(n).padStart(3, '0')}`;
const mockNow = (offset = 0) => `2025-11-08T${String(10 + offset).padStart(2, '0')}:00:00.000Z`;

// Initial Test Data Set
const INITIAL_USERS: iUser[] = [
  { id: mockId(1), inserted: mockNow(0), updated: mockNow(0), deleted: '', is_delete: false, name: 'Alice', age: 28 },
  { id: mockId(2), inserted: mockNow(1), updated: mockNow(1), deleted: '', is_delete: false, name: 'Bob', age: 35 },
  { id: mockId(3), inserted: mockNow(2), updated: mockNow(2), deleted: '', is_delete: true, name: 'Charlie', age: 40 }, // Logically deleted
];

// --- Test Suite ---
describe('ofcIndexedDB Comprehensive Test Suite', () => {
  let db: IDBDatabase;
  const STORE_NAME = 'users';
  
  // Runs before each test: Open DB connection and insert initial data
  beforeEach(async () => {
    // Connect to DB and create store
    db = await ofcIndexedDB.connect(TEST_DB_NAME, 1, createStore);
    
    // Insert initial data (ensures test isolation)
    for (const user of INITIAL_USERS) {
      // isProxy: false, genId/now are not used (using values from INITIAL_USERS)
      await ofcIndexedDB.upsert<iUser>(db, STORE_NAME, user, { isProxy: false });
    }
  });

  // Runs after each test: Close DB connection and drop the entire DB
  afterEach(async () => {
    // Closing the DB connection is crucial; otherwise, drop might be blocked
    db.close(); 
    // Delete the entire DB to return the environment to a clean state
    await ofcIndexedDB.drop(TEST_DB_NAME); 
  }, 10000); // Set timeout to 10 seconds

  // --- Connection / Utilities ---

  test('connect, createStore, and drop operations work', async () => {
    expect(db.name).toBe(TEST_DB_NAME);
    expect(db.version).toBe(1);
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);

    // Verify drop function on a temporary DB
    const result = await ofcIndexedDB.drop('TransientDB');
    expect(result).toBe(true);
  });
  
  // --- upsert (Insert/Update) ---

  test('upsert inserts a new record with generated ID/timestamps', async () => {
    const newUser: iUser = { 
      // id, inserted, updated, deleted, is_delete are handled automatically by ofcRecBase
      id: '', inserted: '', updated: '', deleted: '', is_delete: false, 
      name: 'David', age: 50 
    };
    
    // Insert
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE_NAME, newUser, {
      genId: () => mockId(4),
      now: () => mockNow(10) 
    });

    expect(id).toBe(mockId(4));

    // Retrieve and verify
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, id);
    expect(rec.name).toBe('David');
    expect(rec.inserted).toBe(mockNow(10));
    expect(rec.updated).toBe(mockNow(10));
  });

  test('upsert updates an existing record', async () => {
    const existingRec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, mockId(1));
    existingRec.name = 'Alice Updated';

    // Update
    const id = await ofcIndexedDB.upsert<iUser>(db, STORE_NAME, existingRec, {
      now: () => mockNow(11) // New update timestamp
    });

    expect(id).toBe(mockId(1));

    // Retrieve and verify
    const updatedRec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, id);
    expect(updatedRec.name).toBe('Alice Updated');
    // inserted should remain the same
    expect(updatedRec.inserted).toBe(mockNow(0)); 
    // updated should change
    expect(updatedRec.updated).toBe(mockNow(11)); 
  });
  
  // --- get (Single Retrieval) ---

  test('get retrieves a record by primary key (id)', async () => {
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, mockId(2));
    expect(rec.name).toBe('Bob');
    expect(rec.age).toBe(35);
  });

  test('get retrieves a record by index', async () => {
    // Retrieve 'Alice' using the 'name' index
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, 'Alice', 'name');
    expect(rec.id).toBe(mockId(1));
  });
  
  test('get returns empty object when record is not found', async () => {
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, 'not-found');
    expect(rec).toEqual({});
  });

  // --- count (Record Count) ---
  
  test('count returns the total number of records', async () => {
    // Number of initial data records (3)
    const cnt = await ofcIndexedDB.count(db, STORE_NAME);
    expect(cnt).toBe(3); 
  });

  // --- list (All/Range Retrieval) ---
  
  test('list returns all records when no range is specified', async () => {
    const list = await ofcIndexedDB.list<iUser>(db, STORE_NAME);
    expect(list.length).toBe(3);
    expect(list.some(r => r.name === 'Charlie')).toBe(true); // Includes logically deleted records
  });

  test('list retrieves records within a key range (ID Bounded)', async () => {
    const list = await ofcIndexedDB.list<iUser>(db, STORE_NAME, undefined, mockId(1), mockId(2));
    expect(list.length).toBe(2);
    expect(list.map(r => r.name)).toEqual(['Alice', 'Bob']); 
  });
  
  test('list retrieves records by a single key (ID Only)', async () => {
    const list = await ofcIndexedDB.list<iUser>(db, STORE_NAME, undefined, mockId(2), mockId(2));
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Bob'); 
  });

  test('list retrieves records using index and range (Age LowerBound)', async () => {
    // Records with age >= 35 (Bob:35, Charlie:40)
    const list = await ofcIndexedDB.list<iUser>(db, STORE_NAME, 'age', 35);
    expect(list.length).toBe(2);
    expect(list.some(r => r.name === 'Alice')).toBe(false); 
  });

  // --- select (Conditional Filter / WHERE Clause equivalent) ---

  test('select filters records by the "where" function (excluding deleted)', async () => {
    // Records with age < 35 AND not logically deleted (Alice: 28)
    const list = await ofcIndexedDB.select<iUser>(
      db,
      STORE_NAME,
      (rec) => rec.age < 35 && !rec.is_delete, 
      { includeDeleted: false }
    );
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Alice');
  });

  test('select includes logically deleted records when includeDeleted is true', async () => {
    // Records with age >= 40 (Charlie: 40)
    const list = await ofcIndexedDB.select<iUser>(
      db,
      STORE_NAME,
      (rec) => rec.age >= 40, 
      { includeDeleted: true }
    );
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Charlie'); // Logically deleted but retrieved
  });
  
  test('select retrieves all non-deleted records when no where clause is given and includeDeleted is false', async () => {
    const list = await ofcIndexedDB.select<iUser>(
      db,
      STORE_NAME,
      () => true, 
      { includeDeleted: false } // Default behavior (excludes logically deleted)
    );
    expect(list.length).toBe(2); // Only Alice and Bob
    expect(list.some(r => r.name === 'Charlie')).toBe(false);
  });

  // --- delete (Deletion) ---

  test('delete marks record as logically deleted when logical=true', async () => {
    const idToDelete = mockId(1);
    
    // Perform logical deletion
    const result = await ofcIndexedDB.delete(db, STORE_NAME, idToDelete, {
      logical: true,
      now: () => mockNow(20),
    });
    expect(result).toBe(true);

    // Retrieve the record and confirm is_delete is true
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, idToDelete);
    expect(rec.is_delete).toBe(true);
    expect(rec.deleted).toBe(mockNow(20)); // Verify the deleted field is set
    expect(rec.updated).toBe(mockNow(20)); // Verify the updated field is also set
  });

  test('delete physically removes record when logical=false', async () => {
    const idToDelete = mockId(2);
    
    // Perform physical deletion
    const ok = await ofcIndexedDB.delete(db, STORE_NAME, idToDelete, { logical: false });
    expect(ok).toBe(true);

    // Confirm the record is completely removed
    const rec = await ofcIndexedDB.get<iUser>(db, STORE_NAME, idToDelete);
    expect(rec).toEqual({});
    
    // Confirm the record count has decreased
    const cnt = await ofcIndexedDB.count(db, STORE_NAME);
    expect(cnt).toBe(2); 
  });

  // --- clear (Clear All Records) ---
  
  test('clear deletes all records from the store', async () => {
    // Count before execution
    expect(await ofcIndexedDB.count(db, STORE_NAME)).toBe(3); 

    // Execute clear
    const cleared = await ofcIndexedDB.clear(db, STORE_NAME);
    expect(cleared).toBe(true);

    // Count after execution
    const cnt = await ofcIndexedDB.count(db, STORE_NAME);
    expect(cnt).toBe(0);
  });

  // --- defineStore (Type-safe Shortcut Factory) ---

  test('defineStore creates typed shortcut and performs CRUD', async () => {
    // Define the Store Wrapper
    const sUsers = ofcIndexedDB.defineStore<iUser>(STORE_NAME, {
      genId: () => mockId(5),
      now: () => mockNow(30),
      logicalDelete: true,
    });

    // 1. Insert (upsert)
    const id = await sUsers.upsert(db, {
      id: '', inserted: '', updated: '', deleted: '', is_delete: false, name: 'Cathy', age: 22,
    });
    expect(id).toBe(mockId(5));

    // 2. Get
    const rec = await sUsers.get(db, id);
    expect(rec.name).toBe('Cathy');

    // 3. Count
    // Existing 3 records + 1 new record = 4 records
    const cnt = await sUsers.count(db);
    expect(cnt).toBe(4); 

    // 4. Select (Default: Excludes logically deleted records)
    // Alice, Bob, Cathy (3 records)
    const active = await sUsers.select(db, (r) => r.age < 50); 
    expect(active.length).toBe(3);

    // 5. Delete (logical=true is the default setting)
    const del = await sUsers.delete(db, id);
    expect(del).toBe(true);
    
    // Verify with Select (Cathy is deleted, remaining Alice, Bob = 2 records)
    const activeAfterDelete = await sUsers.select(db, () => true);
    expect(activeAfterDelete.length).toBe(2); 

    // 6. Clear
    const cleared = await sUsers.clear(db);
    expect(cleared).toBe(true);
    expect(await sUsers.count(db)).toBe(0);
  });
});