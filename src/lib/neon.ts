// Neon Postgres Client & Query Builder
// Executes queries over Neon HTTP driver / fetch with zero native dependencies

const RAW_DATABASE_URL = process.env.EXPO_PUBLIC_NEON_DATABASE_URL || '';
// Neon HTTP /sql requests must route to the compute endpoint, not the TCP pooler
const DATABASE_URL = RAW_DATABASE_URL.replace('-pooler', '');

function parseHost(url: string): string {
  try {
    const atSplit = url.split('@');
    if (atSplit.length > 1) {
      const hostPart = atSplit[1].split('/')[0];
      const host = hostPart.split('?')[0];
      return host.replace('-pooler', '');
    }
  } catch (e) {
    // fallback
  }
  return 'ep-broad-fire-b5t3ep7p.c-7.us-east-2.aws.neon.tech';
}

const NEON_HOST = parseHost(DATABASE_URL);
const SQL_ENDPOINT = `https://${NEON_HOST}/sql`;

export async function executeSql<T = any>(query: string): Promise<{ data: T[] | null; error: any }> {
  try {
    const res = await fetch(SQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': DATABASE_URL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: json };
    }
    return { data: (json.rows as T[]) || [], error: null };
  } catch (err: any) {
    console.error('Neon SQL Error:', err);
    return { data: null, error: err };
  }
}

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return `${value}`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') {
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

class QueryBuilder<T = any> implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectedFields: string = '*';
  private whereClauses: string[] = [];
  private orderClauses: string[] = [];
  private limitCount?: number;
  private isSingle = false;
  private insertPayload?: any;
  private updatePayload?: any;
  private isCountQuery = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.selectedFields = fields;
    if (options?.count === 'exact') {
      this.isCountQuery = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`${this.qualify(column)} IS NULL`);
    } else {
      this.whereClauses.push(`${this.qualify(column)} = ${escapeSqlValue(value)}`);
    }
    return this;
  }

  neq(column: string, value: any) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`${this.qualify(column)} IS NOT NULL`);
    } else {
      this.whereClauses.push(`${this.qualify(column)} != ${escapeSqlValue(value)}`);
    }
    return this;
  }

  gt(column: string, value: any) {
    this.whereClauses.push(`${this.qualify(column)} > ${escapeSqlValue(value)}`);
    return this;
  }

  gte(column: string, value: any) {
    this.whereClauses.push(`${this.qualify(column)} >= ${escapeSqlValue(value)}`);
    return this;
  }

  lt(column: string, value: any) {
    this.whereClauses.push(`${this.qualify(column)} < ${escapeSqlValue(value)}`);
    return this;
  }

  lte(column: string, value: any) {
    this.whereClauses.push(`${this.qualify(column)} <= ${escapeSqlValue(value)}`);
    return this;
  }

  in(column: string, values: any[]) {
    if (!values || values.length === 0) {
      this.whereClauses.push('1 = 0');
    } else {
      const list = values.map(escapeSqlValue).join(', ');
      this.whereClauses.push(`${this.qualify(column)} IN (${list})`);
    }
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderClauses.push(`${this.qualify(column)} ${ascending ? 'ASC' : 'DESC'}`);
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.insertPayload = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.updatePayload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  private qualify(col: string): string {
    return `public.${this.tableName}.${col}`;
  }

  private buildQuery(): string {
    const table = `public.${this.tableName}`;

    if (this.action === 'insert') {
      const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
      if (rows.length === 0) return `SELECT 1 WHERE 1=0;`;
      const keys = Object.keys(rows[0]);
      const columnsList = keys.map((k) => `"${k}"`).join(', ');
      const valuesList = rows
        .map((r) => `(${keys.map((k) => escapeSqlValue(r[k])).join(', ')})`)
        .join(', ');
      return `INSERT INTO ${table} (${columnsList}) VALUES ${valuesList} RETURNING *;`;
    }

    if (this.action === 'update') {
      const keys = Object.keys(this.updatePayload || {});
      const setList = keys.map((k) => `"${k}" = ${escapeSqlValue(this.updatePayload[k])}`).join(', ');
      const where = this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(' AND ')}` : '';
      return `UPDATE ${table} SET ${setList} ${where} RETURNING *;`;
    }

    if (this.action === 'delete') {
      const where = this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(' AND ')}` : '';
      return `DELETE FROM ${table} ${where} RETURNING *;`;
    }

    // SELECT
    if (this.isCountQuery) {
      const where = this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(' AND ')}` : '';
      return `SELECT COUNT(*)::int as count FROM ${table} ${where};`;
    }

    // Check for joins in selectedFields:
    // course:course_id (...)
    // student:student_id (...)
    // session:session_id (...)
    const joinClauses: string[] = [];
    const selectProjections: string[] = [`${table}.*`];

    if (this.selectedFields.includes('course:course_id')) {
      joinClauses.push(`LEFT JOIN public.courses __course ON __course.id = ${table}.course_id`);
      selectProjections.push(`row_to_json(__course.*) as course`);
    }
    if (this.selectedFields.includes('student:student_id')) {
      joinClauses.push(`LEFT JOIN public.users __student ON __student.id = ${table}.student_id`);
      selectProjections.push(`row_to_json(__student.*) as student`);
    }
    if (this.selectedFields.includes('session:session_id')) {
      joinClauses.push(`LEFT JOIN public.attendance_sessions __session ON __session.id = ${table}.session_id`);
      selectProjections.push(`row_to_json(__session.*) as session`);
    }

    const where = this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(' AND ')}` : '';
    const order = this.orderClauses.length > 0 ? `ORDER BY ${this.orderClauses.join(', ')}` : '';
    const limit = this.limitCount ? `LIMIT ${this.limitCount}` : '';

    return `SELECT ${selectProjections.join(', ')} FROM ${table} ${joinClauses.join(' ')} ${where} ${order} ${limit};`;
  }

  async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    const sql = this.buildQuery();
    const result = await executeSql(sql);

    if (result.error) {
      return { data: null, error: result.error, count: null };
    }

    if (this.isCountQuery) {
      const count = result.data?.[0]?.count ?? 0;
      return { data: null, error: null, count };
    }

    if (this.isSingle) {
      return { data: result.data?.[0] || null, error: null };
    }

    return { data: result.data || [], error: null };
  }

  then<TResult1 = { data: any; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const db = {
  from: (tableName: string) => new QueryBuilder(tableName),
  channel: (name: string) => ({
    on: (_type: string, _filter: any, _callback: (payload: any) => void) => ({
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
  }),
  removeChannel: (_channel: any) => {},
};

export const useNeonClient = () => db;
