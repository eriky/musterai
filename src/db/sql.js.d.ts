declare module 'sql.js' {
  interface Database {
    exec(sql: string, params?: unknown[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    getRowsModified(): number;
    close(): void;
  }

  interface Statement {
    bind(params?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  function initSqlJs(config?: {}): Promise<{
    Database: new (data?: Uint8Array | ArrayBuffer | string) => Database;
  }>;

  export default initSqlJs;
}
