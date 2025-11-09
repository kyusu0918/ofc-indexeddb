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
export interface iofcRecBase {
  id: string;
  inserted: string;
  updated: string;
  deleted: string;
  is_delete: boolean;
}

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
      const openResult: IDBOpenDBRequest = window.indexedDB.open(dbName, dbVersion);

      // Connection success
      openResult.onsuccess = (e: Event) => { resolve(((e.target as IDBOpenDBRequest).result as IDBDatabase)); }

      // Connection error
      openResult.onerror = (e: Event) => { reject(new Error("Failed to connect to the database.")); }

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
   * @since 2025/11/04
   * @author Kei Yusu
   *
   *********************************************************************************/
  list: async <T extends iofcRecBase>(
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
  select: async <T extends iofcRecBase>(
    db: IDBDatabase,
    store: string,
    where: (record: T) => boolean,
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
        const record = cursor.value as T;

        // If logically deleted records are not included, skip logically deleted records
        if(!includeDeleted && record.is_delete){

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
          if (condition(record)) resultSet.push(record);

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
  upsert: async <T extends iofcRecBase>(
    db: IDBDatabase,
    store: string,
    rec: T,
    options?: {
      isProxy?: boolean;
      genId?: () => string;
      now?: () => string;
    }
  ): Promise<string> => {

    // Wrap in Promise
    return new Promise<string>((resolve, reject) => {

      // Set options
      const genId = options?.genId ?? (() => crypto.randomUUID());
      const now = options?.now ?? (() => new Date().toISOString());
      const isProxy = options?.isProxy ?? false;

      // If the object is wrapped by a Proxy, reconstruct the object forcefully via a JSON string
      // * This is necessary if wrapped via vue3's reactive
      const upsertRec = isProxy ? JSON.parse(JSON.stringify(rec)) : rec;

      // Set ID
      (upsertRec as iofcRecBase).id = !(upsertRec as iofcRecBase).id ? genId() : (upsertRec as iofcRecBase).id;

      // Set insertion date/time
      (upsertRec as iofcRecBase).inserted = !(upsertRec as iofcRecBase).inserted ? now() : (upsertRec as iofcRecBase).inserted;

      // Set update date/time
      (upsertRec as iofcRecBase).updated = now();

      // Set deletion date/time (blank for extension)
      (upsertRec as iofcRecBase).deleted = !(upsertRec as iofcRecBase).deleted ? "" : (upsertRec as iofcRecBase).deleted;

      // Set deletion flag (False for extension)
      (upsertRec as iofcRecBase).is_delete = !(upsertRec as iofcRecBase).is_delete ? false : (upsertRec as iofcRecBase).is_delete;

      // Get object store
      const objectStore: IDBObjectStore = db.transaction(store, "readwrite").objectStore(store);

      // Add or update
      const request:IDBRequest = objectStore.put(upsertRec);

      // Add/update success event
      request.onsuccess = (e: Event) => { resolve((upsertRec as iofcRecBase).id); };

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

      // Retrieve record
      const record = await ofcIndexedDB.get<iofcRecBase>(db, store, key);

      // Return false if record is not found
      if (!record.id) return false;

      // Set deleted flag
      record.is_delete = true;

      // Set deletion date/time
      record.deleted = now();

      // Update record
      await ofcIndexedDB.upsert<iofcRecBase>(db, store, record, {now});

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
  defineStore: function <T extends iofcRecBase>(
    store: string,
    defaults?: {
      genId?: () => string;
      now?: () => string;
      logicalDelete?: boolean
    }
  ) {

    // Define default functions (secured within scope)
    const genId = defaults?.genId ?? (() => crypto.randomUUID());
    const now = defaults?.now ?? (() => new Date().toISOString());
    const logicalDelete = defaults?.logicalDelete ?? true;

    // Set return value
    return {
      /**********************
       * Get all records
       **********************/
      list: (db: IDBDatabase, index?: string, from?: string | number, to?: string | number): Promise<T[]> =>
        ofcIndexedDB.list<T>(db, store, index, from, to),

      /**********************
       * Get by condition (WHERE equivalent)
       **********************/
      select: (db: IDBDatabase, where?: (record: T) => boolean): Promise<T[]> =>
        ofcIndexedDB.select<T>(db, store, where ?? (() => true), { includeDeleted: !logicalDelete }),

      /**********************
       * Get single record
       **********************/
      get: (db: IDBDatabase, key: string | number, index?: string): Promise<T> =>
        ofcIndexedDB.get<T>(db, store, key, index),

      /**********************
       * Get count
       **********************/
      count: (db: IDBDatabase): Promise<number> =>
        ofcIndexedDB.count(db, store),

      /**********************
       * Add / Update
       **********************/
      upsert: (db: IDBDatabase, rec: T, isProxy?: boolean): Promise<string> => {
        const options = {
          // Conditionally spread isProxy if it is defined
          ...(isProxy !== undefined ? { isProxy } : {}),
          genId,
          now,
        };
        return ofcIndexedDB.upsert<T>(db, store, rec, options);
      },

      /**********************
       * Delete
       **********************/
      delete: (db: IDBDatabase, key: string | number): Promise<boolean> =>
        ofcIndexedDB.delete(db, store, key, {logical: logicalDelete, now} ),

      /**********************
       * Clear all (truncate)
       **********************/
      clear: (db: IDBDatabase): Promise<boolean> =>
        ofcIndexedDB.clear(db, store),
    } as const;

  },

}

export default ofcIndexedDB;