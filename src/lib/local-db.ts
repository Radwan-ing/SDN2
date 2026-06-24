
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Device } from '@capacitor/device';

class LocalDatabase {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private observers: Map<string, Set<(data: any[]) => void>> = new Map();
  private initializingPromise: Promise<void> | null = null;
  private queue: Promise<any> = Promise.resolve();

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private getSqlite(): SQLiteConnection {
    if (!this.sqlite) {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }
    return this.sqlite;
  }

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      const info = await Device.getInfo();
      const platform = info.platform;
      const sqlite = this.getSqlite();

    try {
      if (platform === 'web') {
        const waitForJeepSqlite = async () => {
          const check = () => document.querySelector('jeep-sqlite');
          if (check()) return;
          
          return new Promise<void>((resolve) => {
            const observer = new MutationObserver(() => {
              if (check()) {
                observer.disconnect();
                resolve();
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            // Timeout after 2 seconds
            setTimeout(() => {
              observer.disconnect();
              resolve();
            }, 2000);
          });
        };

        await waitForJeepSqlite();
        await sqlite.initWebStore();
      }

      this.db = await sqlite.createConnection('snd_system', false, 'no-encryption', 1, false);
      await this.db.open();
      
      // Create Tables
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          password TEXT,
          name TEXT,
          role TEXT,
          isPrimary INTEGER,
          userNumber INTEGER
        );

        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          data TEXT
        );

        CREATE TABLE IF NOT EXISTS company_details (
          id TEXT PRIMARY KEY,
          shopName TEXT,
          phone1 TEXT,
          phone2 TEXT,
          landline TEXT,
          phone1Call INTEGER,
          phone1Whatsapp INTEGER,
          phone2Call INTEGER,
          phone2Whatsapp INTEGER,
          landlineCall INTEGER,
          landlineWhatsapp INTEGER,
          facebookUrl TEXT,
          mapUrl TEXT,
          email TEXT,
          bio TEXT,
          logoUrl TEXT,
          address TEXT,
          updatedAt TEXT,
          bankYerName TEXT,
          bankYerAccount TEXT,
          bankSarName TEXT,
          bankSarAccount TEXT,
          bankUsdName TEXT,
          bankUsdAccount TEXT,
          bankHolderName TEXT
        );

        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          customerNumber INTEGER,
          name TEXT,
          phone1 TEXT,
          phone2 TEXT,
          companyName TEXT,
          email TEXT,
          notes TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoiceNumber TEXT,
          customerId TEXT,
          customerName TEXT,
          currency TEXT,
          totalCost REAL,
          amountPaid REAL,
          discount REAL,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          notes TEXT,
          cancelReason TEXT
        );

        CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY,
          invoiceId TEXT,
          categoryId TEXT,
          deviceName TEXT,
          invoiceNumber TEXT,
          deviceType TEXT,
          quantity INTEGER,
          faultType TEXT,
          deviceNotes TEXT,
          technicalNotes TEXT,
          cost REAL,
          status TEXT,
          subStatus TEXT,
          source TEXT,
          customerProblem TEXT,
          engineerReport TEXT,
          failureReason TEXT,
          unitCost REAL,
          deliveredAt TEXT,
          recipientName TEXT,
          createdBy TEXT,
          technician TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          updatedBy TEXT,
          customerId TEXT,
          customerName TEXT
        );

        CREATE TABLE IF NOT EXISTS vault_transactions (
          id TEXT PRIMARY KEY,
          currency TEXT,
          amount REAL,
          customerName TEXT,
          invoiceNumber TEXT,
          userName TEXT,
          userNumber INTEGER,
          userId TEXT,
          timestamp TEXT,
          type TEXT,
          notes TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS maintenance_actions (
          id TEXT PRIMARY KEY,
          engineerName TEXT,
          actionDate TEXT,
          type TEXT,
          notes TEXT,
          updates TEXT, -- JSON string
          createdAt TEXT,
          updatedAt TEXT,
          userId TEXT,
          userName TEXT
        );

        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT,
          quantity INTEGER,
          minQuantity INTEGER,
          category TEXT,
          price REAL,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS device_categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS device_models (
          id TEXT PRIMARY KEY,
          categoryId TEXT,
          categoryName TEXT,
          name TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS engineers (
          id TEXT PRIMARY KEY,
          name TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS approval_actions (
          id TEXT PRIMARY KEY,
          invoiceNumber TEXT,
          customerName TEXT,
          decision TEXT,
          date INTEGER,
          userId TEXT,
          userName TEXT,
          engineerName TEXT,
          actionDate INTEGER,
          type TEXT,
          updates TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS fin_transaction_types (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT
        );

        CREATE TABLE IF NOT EXISTS fin_funds (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          currency TEXT,
          description TEXT,
          status TEXT,
          balance REAL,
          bankAccount TEXT
        );

        CREATE TABLE IF NOT EXISTS fin_currencies (
          id TEXT PRIMARY KEY,
          name TEXT,
          symbol TEXT,
          decimals INTEGER,
          status TEXT
        );

        CREATE TABLE IF NOT EXISTS fin_payment_methods (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          status TEXT
        );

        CREATE TABLE IF NOT EXISTS document_outputs (
          id TEXT PRIMARY KEY,
          document_id TEXT,
          document_number TEXT,
          output_type TEXT,
          output_datetime TEXT,
          user_id TEXT
        );
      `);

      // Ensure document_outputs table is created for existing databases as well
      try {
        await this.db.run(`
          CREATE TABLE IF NOT EXISTS document_outputs (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            document_number TEXT,
            output_type TEXT,
            output_datetime TEXT,
            user_id TEXT
          );
        `);
      } catch (err) {}

      // Attempt to add extra financial columns to existing vault_transactions table if needed
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN voucherNumber INTEGER');
      } catch (err) {}
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN transactionCategory TEXT');
      } catch (err) {}
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN fundId TEXT');
      } catch (err) {}
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN fundName TEXT');
      } catch (err) {}
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN paymentMethod TEXT');
      } catch (err) {}
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN customerId TEXT');
      } catch (err) {}

      // Attempt to add bank details columns to existing company_details table if needed
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankYerName TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankYerAccount TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankSarName TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankSarAccount TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankUsdName TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankUsdAccount TEXT'); } catch (err) {}
      try { await this.db.run('ALTER TABLE company_details ADD COLUMN bankHolderName TEXT'); } catch (err) {}

      // Attempt to add notes column to existing invoices table if needed
      try {
        await this.db.run('ALTER TABLE invoices ADD COLUMN notes TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add discount column to existing invoices table if needed
      try {
        await this.db.run('ALTER TABLE invoices ADD COLUMN discount REAL');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add cancelReason column to existing invoices table if needed
      try {
        await this.db.run('ALTER TABLE invoices ADD COLUMN cancelReason TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add categoryName column to existing device_models table if needed
      try {
        await this.db.run('ALTER TABLE device_models ADD COLUMN categoryName TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add customerId column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN customerId TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add customerName column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN customerName TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add createdAt column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN createdAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }
      
      // Attempt to add categoryId column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN categoryId TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add deviceName column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN deviceName TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add deviceNotes column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN deviceNotes TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add type column to existing maintenance_actions table if needed
      try {
        await this.db.run('ALTER TABLE maintenance_actions ADD COLUMN type TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing maintenance_actions table if needed
      try {
        await this.db.run('ALTER TABLE maintenance_actions ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing inventory_items table if needed
      try {
        await this.db.run('ALTER TABLE inventory_items ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing engineers table if needed
      try {
        await this.db.run('ALTER TABLE engineers ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing customers table if needed
      try {
        await this.db.run('ALTER TABLE customers ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add companyName column to existing customers table if needed
      try {
        await this.db.run('ALTER TABLE customers ADD COLUMN companyName TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add email column to existing customers table if needed
      try {
        await this.db.run('ALTER TABLE customers ADD COLUMN email TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add notes column to existing customers table if needed
      try {
        await this.db.run('ALTER TABLE customers ADD COLUMN notes TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedBy column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN updatedBy TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add subStatus column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN subStatus TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add source column to existing invoice_items table if needed
      try {
        await this.db.run('ALTER TABLE invoice_items ADD COLUMN source TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }
      
      // Attempt to add updatedAt column to existing vault_transactions table if needed
      try {
        await this.db.run('ALTER TABLE vault_transactions ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updatedAt column to existing device_categories table if needed
      try {
        await this.db.run('ALTER TABLE device_categories ADD COLUMN updatedAt TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add bankAccount column to existing fin_funds table if needed
      try {
        await this.db.run('ALTER TABLE fin_funds ADD COLUMN bankAccount TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add engineerName column to existing approval_actions table if needed
      try {
        await this.db.run('ALTER TABLE approval_actions ADD COLUMN engineerName TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add actionDate column to existing approval_actions table if needed
      try {
        await this.db.run('ALTER TABLE approval_actions ADD COLUMN actionDate INTEGER');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add type column to existing approval_actions table if needed
      try {
        await this.db.run('ALTER TABLE approval_actions ADD COLUMN type TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Attempt to add updates column to existing approval_actions table if needed
      try {
        await this.db.run('ALTER TABLE approval_actions ADD COLUMN updates TEXT');
      } catch (err) {
        // Column probably already exists, which is fine
      }

      // Seed default admin if empty
      const users = await this.db.query('SELECT * FROM users WHERE username = ?', ['admin']);
      if (users.values && users.values.length === 0) {
        await this.db.run('INSERT INTO users (id, username, password, name, role, isPrimary) VALUES (?, ?, ?, ?, ?, ?)', 
          ['primary-admin', 'admin', 'admin', 'المدير العام', 'admin', 1]);
      }

      // Seed accounting defaults: Currencies
      const currs = await this.db.query('SELECT * FROM fin_currencies');
      if (currs.values && currs.values.length === 0) {
        await this.db.run('INSERT INTO fin_currencies (id, name, symbol, decimals, status) VALUES (?, ?, ?, ?, ?)',
          ['USD', 'دولار', '$', 2, 'active']);
        await this.db.run('INSERT INTO fin_currencies (id, name, symbol, decimals, status) VALUES (?, ?, ?, ?, ?)',
          ['YER', 'ريال يمني', 'ر.ي', 0, 'active']);
        await this.db.run('INSERT INTO fin_currencies (id, name, symbol, decimals, status) VALUES (?, ?, ?, ?, ?)',
          ['SAR', 'ريال سعودي', 'ر.س', 0, 'active']);
      }

      // Seed accounting defaults: Funds
      const fundsTable = await this.db.query('SELECT * FROM fin_funds');
      if (fundsTable.values && fundsTable.values.length === 0) {
        await this.db.run('INSERT INTO fin_funds (id, name, type, currency, description, status, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['fund-1', 'صندوق 1', 'cash', 'دولار', 'الصندوق الرئيسي التلقائي', 'active', 0.0]);
      }

      // Seed accounting defaults: Payment Methods
      const payMethods = await this.db.query('SELECT * FROM fin_payment_methods');
      if (payMethods.values && payMethods.values.length === 0) {
        await this.db.run('INSERT INTO fin_payment_methods (id, name, description, status) VALUES (?, ?, ?, ?)',
          ['pay-cash', 'نقداً', 'الدفع نقداً التلقائي', 'active']);
        await this.db.run('INSERT INTO fin_payment_methods (id, name, description, status) VALUES (?, ?, ?, ?)',
          ['pay-bank', 'إيداع بنكي', 'الإيداع بنكي التلقائي', 'active']);
      }

      // Seed accounting defaults: Transaction Types
      const txTypes = await this.db.query('SELECT * FROM fin_transaction_types');
      if (txTypes.values && txTypes.values.length === 0) {
        const defaultReceipts = ['دفعة تحت الحساب', 'خدمات برمجية', 'بيع قطع غيار', 'ايرادات أخرى'];
        for (const item of defaultReceipts) {
          await this.db.run('INSERT INTO fin_transaction_types (id, name, type) VALUES (?, ?, ?)',
            [`rec-${Math.random().toString(36).substring(2, 8)}`, item, 'receipt']);
        }
        const defaultPayments = [
          'راتب موظف',
          'شراء قطع غيار',
          'شراء معدات صيانه',
          'مصاريف تشغيل',
          'مصاريف نقل',
          'مصاريف كهرباء',
          'مصاريف إنترنت',
          'مصاريف ضيافة',
          'مصروفات أخرى'
        ];
        for (const item of defaultPayments) {
          await this.db.run('INSERT INTO fin_transaction_types (id, name, type) VALUES (?, ?, ?)',
            [`pay-${Math.random().toString(36).substring(2, 8)}`, item, 'payment']);
        }
      }

      if (platform === 'web') {
        await sqlite.saveToStore('snd_system');
      }

    } catch (err) {
      console.error('SQLite initialization failed', err);
    }
    })();

    return this.initializingPromise;
  }

  // Generic Query
  async query(sql: string, params: any[] = []) {
    return this.enqueue(async () => {
      if (!this.db) {
        console.error('Database not initialized. Attempting recovery...');
        await this.initialize();
      }
      if (!this.db) throw new Error('Failed to initialize local database connection.');
      return this.db.query(sql, params);
    });
  }

  // Generic Execute
  async run(sql: string, params: any[] = []) {
    return this.enqueue(async () => {
      if (!this.db) {
        console.error('Database not initialized. Attempting recovery...');
        await this.initialize();
      }
      if (!this.db) throw new Error('Failed to initialize local database connection.');
      const result = await this.db.run(sql, params);
      
      const info = await Device.getInfo();
      if (info.platform === 'web') {
        await this.getSqlite().saveToStore('snd_system');
      }
      
      return result;
    });
  }

  // Notify observers
  notify(table: string, data: any[]) {
    const tableObservers = this.observers.get(table);
    if (tableObservers) {
      tableObservers.forEach(callback => callback(data));
    }
  }

  subscribe(table: string, callback: (data: any[]) => void) {
    if (!this.observers.has(table)) {
      this.observers.set(table, new Set());
    }
    this.observers.get(table)!.add(callback);
    
    // Initial fetch
    this.query(`SELECT * FROM ${table}`).then(res => {
      callback(res.values || []);
    });

    return () => {
      this.observers.get(table)?.delete(callback);
    };
  }
}

export const localDb = new LocalDatabase();
