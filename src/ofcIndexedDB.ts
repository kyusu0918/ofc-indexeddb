/********************************************************************************
 * ofcIndexedDB - A type-safe IndexedDB wrapper for TypeScript.
 *
 * Provides typed store factories, simple CRUD methods, and built-in logical delete support.
 *
 * @since 2025/11/04
 * @author Kei Yusu
 * 
 *********************************************************************************/

// Base record interface
export interface OfcRec {
  id: string;
  inserted: string;
  updated: string;
  deleted: string;
  is_delete: boolean;
}

// Type helper(defineStore)
export type OfcDefinedStore<T extends OfcRec> = ReturnType<
  typeof ofcIndexedDB.defineStore<T>
>;

// Type helper(bindStore)
export type OfcBoundStore<T extends OfcRec> = ReturnType<
  typeof ofcIndexedDB.bindStore<T>
>;

/********************************************************************************
 * ofcIndexedDB
 *
 * @since 2025/11/04
 * @author Kei Yusu
 *
 *********************************************************************************/
export const ofcIndexedDB = {

  //----------------------
  // Constant Definitions
  //----------------------
  // DB Name
  name: "ofcIndexedDB",

  // Version
  version: 1,

  /********************************************************************************
   * Connect to DB
   *
   * @param name DB name
   * @param version Version
   * @callback createFunc Function for DB creation (onupgradeneeded)
   * @return DB object
   * @throws Error - when Failed to create to the database.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  connect: async (
    name?: string,
    version?: number,
    createFunc?: (db: IDBDatabase) => void): Promise<IDBDatabase> => {

    // Wrap in Promise
    return new Promise<IDBDatabase>((resolve, reject) => {

      // Get DB name
      const dbName = name ? name : ofcIndexedDB.name;

      // Get DB version
      const dbVersion = version ? version : ofcIndexedDB.version;

      // Open the database
      const openResult: IDBOpenDBRequest = (globalThis.indexedDB ?? window.indexedDB).open(dbName, dbVersion);

      // Connection success
      openResult.onsuccess = (e: Event) => { resolve(((e.target as IDBOpenDBRequest).result as IDBDatabase)); }

      // Connection error
      openResult.onerror = (e: Event) => { reject(new Error("Failed to connect to the database.")); }

      // Connection block
      openResult.onblocked = () => { console.warn(`Database "${dbName}" Connection was blocked by an open connection.`); }

      // If a DB creation function is provided
      if(createFunc){

        try {

          // Upgrade event
          openResult.onupgradeneeded = (e: Event) => { createFunc((e.target as IDBOpenDBRequest).result as IDBDatabase) }

        } catch (e) {

          // create error
          reject(new Error("Failed to create to the database."));

        }

      }

    })

  },

  /********************************************************************************
   * Create Object Store
   *
   * @param db DB object
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  createStore: (
    db: IDBDatabase,
    createFunc: (db: IDBDatabase) => void): void => {

    // Object store creation
    createFunc(db);

  },

  /********************************************************************************
   * Drop DB
   *
   * @param name DB name
   * @return true:Success false:Failure
   * @throws Error - when Failed to delete the database.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  drop: async (name?: string): Promise<boolean> => {

    // Wrap in Promise
    return new Promise<boolean>((resolve, reject) => {

      // Get DB name
      const dbName = name ? name : ofcIndexedDB.name;

      // Delete the database
      const deleteResult: IDBOpenDBRequest = window.indexedDB.deleteDatabase(dbName);

      // Deletion success
      deleteResult.onsuccess = (e: Event) => { resolve(true); }

      // Deletion error
      deleteResult.onerror = (e: Event) => { reject(new Error("Failed to delete the database.")); }

      // Deletion block
      deleteResult.onblocked = () => { console.warn(`Database "${dbName}" deletion was blocked by an open connection.`); }

    })

  },

  /********************************************************************************
   * Get a single record
   *
   * @param db DB object
   * @param store Object store name
   * @param key Key to retrieve (id or index key)
   * @param index Index name
   * @return Retrieved record
   * @throws Error - when Failed to get record.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  get: async <T>(
    db: IDBDatabase,
    store: string,
    key: string|number,
    index?: string|undefined): Promise<T> => {

    // Wrap in Promise
    return new Promise<T>((resolve, reject) => {

      // Initialize request
      let request: IDBRequest;

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readonly").objectStore(store);

      // If an index is specified
      if(index){

        // Get the index
        const objectIndex: IDBIndex = objectStore.index(index);

        // Retrieve by index
        request = objectIndex.get(key);

      // If no index is specified (retrieve by id)
      }else{

        // Retrieve by id
        request = objectStore.get(key);

      }

      // Retrieval success event
      request.onsuccess = (e: Event) => {

        // If record exists
        if(request.result !== undefined){

          // Set resolver
          resolve(request.result as T);

        }else {

          // Set resolver (return empty object if not found)
          resolve({} as T);

        }

      };

      // Retrieval failure event
      request.onerror = (e: Event) => { reject(new Error("Failed to get record.")); };

    })

  },

  /********************************************************************************
   * Get record count
   *
   * @param db DB object
   * @param store Object store name
   * @return Record count
   * @throws Error - when Failed to count records.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  count: async (
    db: IDBDatabase,
    store: string): Promise<number> => {

    // Wrap in Promise
    return new Promise<number>((resolve, reject) => {

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readonly").objectStore(store);

      // Get record count
      const request: IDBRequest = objectStore.count();

      // Record count success event
      request.onsuccess = (e: Event) => { resolve(request.result); };

      // Record count failure event
      request.onerror = (e: Event) => { reject(new Error("Failed to count records.")); };

    })

  },

  /********************************************************************************
   * Get multiple records (by key or index range)
   *
   * @param db DB object
   * @param store Object store name
   * @param index Index name (primary key if omitted)
   * @param from Start key value (optional)
   * @param to End key value (optional)
   * @return Retrieved records array
   * @throws Error - when Failed to list records.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  list: async <T extends OfcRec>(
    db: IDBDatabase,
    store: string,
    index?: string|undefined,
    from?: string|number,
    to?: string|number): Promise<T[]> => {

    // Wrap in Promise
    return new Promise<T[]>((resolve, reject) => {

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readonly").objectStore(store);

      // Declare search object (store or index)
      const search: IDBObjectStore | IDBIndex = index ? objectStore.index(index) : objectStore;

      // Declare range object
      let range: IDBKeyRange | null = null;

      // If both From and To are present
      if(from !== undefined && to !== undefined){

        // If From and To are the same
        if(from === to){

          // Retrieve by specific From key
          range = IDBKeyRange.only(from);

        // If From and To are different
        }else{

          // Retrieve within the range of From and To
          range = IDBKeyRange.bound(from, to);

        }

      // If only From is present
      }else if(from !== undefined){

        // Retrieve greater than or equal to From
        range = IDBKeyRange.lowerBound(from);

      // If only To is present
      }else if(to !== undefined){

        // Retrieve less than or equal to To
        range = IDBKeyRange.upperBound(to);

      // If neither From nor To is present
      }else{

        // Do nothing for full retrieval
      }

      // Retrieve records (using range or all)
      const request = range ? search.getAll(range) : search.getAll();

      // Full retrieval success event
      request.onsuccess = (e: Event) => { resolve((request.result ?? []) as T[]); };

      // Full retrieval failure event
      request.onerror = (e: Event) => { reject(new Error("Failed to list records.")); };

    })

  },

  /********************************************************************************
   * Get records by condition (equivalent to WHERE clause)
   *
   * @param db DB object
   * @param store Object store name
   * @param where Condition function (only records that return true are retrieved)
   * @param options Options setting
   * @param options.includeDeleted Flag to include logically deleted records (reconstructed via JSON if true)
   * @return Array of records matching the condition
   * @throws Error - when Failed to select records.
   * @since 2025/11/08
   * @author Kei Yusu
   *
   * @example
   * // Retrieve only records where the title includes "Travel" and is not logically deleted
   * const results = await ofcIndexedDB.select<iTitles>(
   * db,
   * "titles",
   * record => record.title.includes("Travel") && !record.is_delete
   * );
   *********************************************************************************/
  select: async <T extends OfcRec>(
    db: IDBDatabase,
    store: string,
    where: (rec: T) => boolean,
    options?: {
      includeDeleted?: boolean
    }
  ): Promise<T[]> => {

    // Wrap in Promise
    return new Promise<T[]>((resolve, reject) => {

      // Set options
      const includeDeleted = options?.includeDeleted ?? false;

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readonly").objectStore(store);

      // Retrieve records using a cursor
      const request = objectStore.openCursor();

      // Result set array
      const resultSet: T[] = [];

      // Cursor success event
      request.onsuccess = (e: Event) => {

        // Get cursor
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;

        // When the cursor finishes
        if (!cursor) {

          // Set resolver
          resolve(resultSet);

          // Exit
          return;

        }

        // Get record value
        const rec = cursor.value as T;

        // If logically deleted records are not included, skip logically deleted records
        if(!includeDeleted && rec.is_delete){

          // Move to the next record
          cursor.continue();

          // Exit
          return;

        }

        // Evaluate the 'where' function and add if true
        try {

          // Get condition
          const condition = (where && typeof where === "function") ? where : (() => true);

          // If the condition function is met, add to the result set
          if (condition(rec)) resultSet.push(rec);

        } catch (err) {

          console.warn("selectWhere evaluation error:", err);

        }

        // Move to the next record
        cursor.continue();

      };

      // Error handling
      request.onerror = () => reject(new Error("Failed to select records."));

    });

  },

  /********************************************************************************
   * Insert/Update record (upsert)
   *
   * @param db DB object
   * @param store Object store name
   * @param rec Record to insert or update (Type T)
   * @param options Options setting
   * @param options.isProxy Flag to unwrap Proxy (reconstruct via JSON string if true)
   * @param options.genId ID generation function (defaults to crypto.randomUUID)
   * @param options.now Datetime generation function (defaults to ISO format current time)
   * @return New or updated record ID
   * @throws Error - when Failed to insert/update record.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   * @example
   * // Normal use
   * await ofcIndexedDB.upsert<iTitles>(db, "titles", rec);
   *
   * // Overriding datetime function
   * await ofcIndexedDB.upsert<iTitles>(db, "titles", rec, {
   * genId: uuid,
   * now: ofcDateTime.getNowDateTimeString
   * });
   *********************************************************************************/
  upsert: async <T extends OfcRec>(
    db: IDBDatabase,
    store: string,
    rec: Partial<T> & { id?: T["id"] },
    options?: {
      isProxy?: boolean;
      genId?: () => string;
      now?: () => string;
    }
  ): Promise<string> => {

    // Set options
    const genId = options?.genId ?? (() => crypto.randomUUID());
    const now = options?.now ?? (() => new Date().toISOString());
    const isProxy = options?.isProxy ?? false;

    // If the object is wrapped by a Proxy, reconstruct the object forcefully via a JSON string
    // * This is necessary if wrapped via vue3's reactive
    const upsertRec = isProxy ? JSON.parse(JSON.stringify(rec)) : rec;

    // Merge record
    let mergeRec = { ...upsertRec } as T;

    // If ID is specified
    if((upsertRec as OfcRec).id){

      // Get existing record
      const existRec = await ofcIndexedDB.get<T>(db, store, (upsertRec as OfcRec).id);

      // If existing record found
      if(existRec.id){

        // Use existRec as the base and overwrite with values from upsertRec
        mergeRec = { ...existRec, ...upsertRec } as T;

      }

    }

    // Set ID
    (mergeRec as OfcRec).id = !(mergeRec as OfcRec).id ? genId() : (mergeRec as OfcRec).id;

    // Set insertion date/time
    (mergeRec as OfcRec).inserted = !(mergeRec as OfcRec).inserted ? now() : (mergeRec as OfcRec).inserted;

    // Set update date/time
    (mergeRec as OfcRec).updated = (upsertRec as OfcRec).updated ? (upsertRec as OfcRec).updated : now();

    // Set deletion date/time (blank for extension)
    (mergeRec as OfcRec).deleted = !(mergeRec as OfcRec).deleted ? "" : (mergeRec as OfcRec).deleted;

    // Set deletion flag (False for extension)
    (mergeRec as OfcRec).is_delete = !(mergeRec as OfcRec).is_delete ? false : (mergeRec as OfcRec).is_delete;

    // Get object store
    const objectStore: IDBObjectStore = db.transaction(store, "readwrite").objectStore(store);

    // Wrap in Promise
    return new Promise<string>((resolve, reject) => {

      // Add or update
      const request:IDBRequest = objectStore.put(mergeRec);

      // Add/update success event
      request.onsuccess = (e: Event) => { resolve((mergeRec as OfcRec).id); };

      // Add/update failure event
      request.onerror = (e: Event) => { reject(new Error("Failed to insert/update record.")); };

    })
 
  },

  /********************************************************************************
   * Delete record
   *
   * @param db DB instance
   * @param store Object store name
   * @param key Key to retrieve (id or index key)
   * @param options Options setting
   * @param options.logical Logical deletion flag (true for logical delete, false/omitted for physical)
   * @param options.now Datetime generation function (defaults to ISO format current time)
   * @return true:Success / false:Failure
   * @throws Error - when Failed to delete record.
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  delete: async (
    db: IDBDatabase,
    store: string,
    key: string|number,
    options?: {
      logical?: boolean;
      now?: () => string;
    }
  ): Promise<boolean> => {

    // Set options
    const logical = options?.logical ?? false;
    const now = options?.now ?? (() => new Date().toISOString());

    // If logical deletion
    if (logical) {

      // Update record
      await ofcIndexedDB.upsert<OfcRec>(db, store, {id: key as string, is_delete: true, deleted: now() }, {now});

      // Set return value
      return true;

    // If physical deletion
    } else {

      // Wrap in Promise
      return new Promise<boolean>((resolve, reject) => {

        // Get object store
        const objectStore: IDBObjectStore = db.transaction(store, "readwrite").objectStore(store);

        // Delete
        const request:IDBRequest = objectStore.delete(key);

        // Deletion success event
        request.onsuccess = (e: Event) => { resolve(true); };

        // Deletion failure event
        request.onerror = (e: Event) => { reject(new Error("Failed to delete record.")); };

      })

    }

  },

  /********************************************************************************
   * Clear all records
   *
   * @param db DB instance
   * @param store Object store name
   * @return true:Success / false:Failure
   * @throws Error - when Failed to clear records.
   * @since 2025/11/07
   * @author Kei Yusu
   *
   *********************************************************************************/
  clear: async (
    db: IDBDatabase,
    store: string): Promise<boolean> => {

    // Wrap in Promise
    return new Promise<boolean>((resolve, reject) => {

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readwrite").objectStore(store);

      // Clear
      const request:IDBRequest = objectStore.clear();

      // Deletion success event
      request.onsuccess = (e: Event) => { resolve(true); };

      // Deletion failure event
      request.onerror = (e: Event) => { reject(new Error("Failed to clear records.")); };

    })

  },

  /********************************************************************************
   * Close Database Connection
   *
   * @param db - IDBDatabase instance
   * @returns Promise<boolean> - true if closed successfully
   * @throws Error when the database cannot be closed
   * @since 2025/11/11
   * @auth Kei Yusu
   *********************************************************************************/
  close: async (db: IDBDatabase | null): Promise<boolean> => {

    // Wrap in Promise
    return new Promise<boolean>((resolve, reject) => {

      try {

        if (!db) {

          console.warn("[ofcIndexedDB] close skipped: db is null");

          // Deletion failure event
          resolve(false);

          return;

        }

        db.close();

        // Deletion success event
        resolve(true);

      } catch (e) {

        // Deletion failure event
        reject(new Error("Failed to close IndexedDB connection."));

      }
    });

  },

  /********************************************************************************
   * Define Store (Type-safe shortcut generation)
   *
   * @param store Object store name
   * @param defaults Default options setting
   * @param defaults.genId ID generation function (defaults to crypto.randomUUID)
   * @param defaults.now Datetime generation function (defaults to ISO format current time)
   * @param defaults.logicalDelete Default deletion method (true for logical delete)
   * @return Type-safe operation object
   * @since 2025/11/08
   * @author Kei Yusu
   *
   * @example
   * const Titles = ofcIndexedDB.defineStore<iTitles>("titles");
   * await Titles.upsert(db, { id: "001", title: "Test" });
   * const list = await Titles.select(db, r => !r.is_delete);
   * await Titles.delete(db, "001"); 
   *********************************************************************************/
  defineStore: <T extends OfcRec>(
    store: string,
    defaults?: {
      genId?: () => string;
      now?: () => string;
      logicalDelete?: boolean
    }
  ) => {

    // Define default functions (secured within scope)
    const genId = defaults?.genId ?? (() => crypto.randomUUID());
    const now = defaults?.now ?? (() => new Date().toISOString());
    const logicalDelete = defaults?.logicalDelete ?? true;

    // Set return value
    return {

      list: (db: IDBDatabase, index?: string, from?: string | number, to?: string | number): Promise<T[]> =>
        ofcIndexedDB.list<T>(db, store, index, from, to),

      select: (db: IDBDatabase, where?: (rec: T) => boolean): Promise<T[]> =>
        ofcIndexedDB.select<T>(db, store, where ?? (() => true), { includeDeleted: !logicalDelete }),

      get: (db: IDBDatabase, key: string | number, index?: string): Promise<T> =>
        ofcIndexedDB.get<T>(db, store, key, index),

      count: (db: IDBDatabase): Promise<number> =>
        ofcIndexedDB.count(db, store),

      upsert: (db: IDBDatabase, rec: Partial<T> & { id?: T["id"] }, isProxy?: boolean): Promise<string> => {
        const options = {
          // Conditionally spread isProxy if it is defined
          ...(isProxy !== undefined ? { isProxy } : {}),
          genId,
          now,
        };
        return ofcIndexedDB.upsert<T>(db, store, rec, options);
      },

      delete: (db: IDBDatabase, key: string | number): Promise<boolean> =>
        ofcIndexedDB.delete(db, store, key, {logical: logicalDelete, now} ),

      clear: (db: IDBDatabase): Promise<boolean> =>
        ofcIndexedDB.clear(db, store),

    } as const;

  },

  /********************************************************************************
   * Define Store with DB (For framework integration)
   * Binds the IDBDatabase instance to the store methods.
   *
   * @param db DB object (Required for binding)
   * @param store Object store name
   * @param defaults Default options setting
   * @return Type-safe operation object without requiring the 'db' argument
   * @since 2025/11/10
   * @author Kei Yusu
   *
   * @example
   * // Bind 'db' object to the Users object once
   * const Users = ofcIndexedDB.defineStoreWithDB<iUser>(db, "users");
   * // Use without passing 'db'
   * const list = await Users.list();
   *********************************************************************************/
  bindStore: <T extends OfcRec>(
    db: IDBDatabase,
    store: string,
    defaults?: {
      genId?: () => string;
      now?: () => string;
      logicalDelete?: boolean
    }
  ) => {

    // Reuse the logic from defineStore (creates the method object that requires 'db' as first arg)
    const definedStore = ofcIndexedDB.defineStore<T>(store, defaults);

    // Bind the 'db' argument to all methods and remove it from the signature
    return {

      list: (index?: string, from?: string | number, to?: string | number): Promise<T[]> =>
        definedStore.list(db, index, from, to),

      select: (where?: (rec: T) => boolean): Promise<T[]> =>
        definedStore.select(db, where),

      get: (key: string | number, index?: string): Promise<T> =>
        definedStore.get(db, key, index),

      count: (): Promise<number> =>
        definedStore.count(db),

      upsert: (rec: Partial<T> & { id?: T["id"] }, isProxy?: boolean): Promise<string> =>
        definedStore.upsert(db, rec, isProxy),

      delete: (key: string | number): Promise<boolean> =>
        definedStore.delete(db, key),

      clear: (): Promise<boolean> =>
        definedStore.clear(db),

    } as const;

  },

}

export default ofcIndexedDB;