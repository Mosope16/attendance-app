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
    const msg = String(err?.message || err || '');
    const lower = msg.toLowerCase();
    if (
      lower.includes('enotfound') ||
      lower.includes('getaddrinfo') ||
      lower.includes('hostname') ||
      lower.includes('no address associated') ||
      lower.includes('unable to resolve') ||
      lower.includes('neon.tech') ||
      lower.includes('neon database') ||
      lower.includes('network request failed') ||
      lower.includes('network error') ||
      lower.includes('networkerror') ||
      lower.includes('fetch failed') ||
      lower.includes('failed to fetch') ||
      lower.includes('econnrefused') ||
      lower.includes('timedout') ||
      lower.includes('timeout') ||
      lower.includes('err_name_not_resolved') ||
      lower.includes('err_internet_disconnected') ||
      lower.includes('offline')
    ) {
      return {
        data: null,
        error: { message: 'No internet connection. Please connect to the internet and try again.' },
      };
    }
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

class RealtimeChannel {
  private channelName: string;
  private listeners: Array<{
    eventType: string;
    filter: { event?: string; schema?: string; table: string; filter?: string };
    callback: (payload: any) => void;
  }> = [];
  private intervalId: any = null;
  private seenRowKeys = new Map<string, Set<string>>();

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(
    eventType: string,
    filter: { event?: string; schema?: string; table: string; filter?: string },
    callback: (payload: any) => void
  ) {
    this.listeners.push({ eventType, filter, callback });
    return this;
  }

  subscribe() {
    this.startPolling();
    return {
      unsubscribe: () => this.unsubscribe(),
    };
  }

  unsubscribe() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.seenRowKeys.clear();
  }

  private async poll() {
    for (let i = 0; i < this.listeners.length; i++) {
      const listener = this.listeners[i];
      const table = listener.filter.table;
      if (!table) continue;

      let whereClause = '';
      if (listener.filter.filter) {
        const parts = listener.filter.filter.split('=eq.');
        if (parts.length === 2) {
          const col = parts[0].trim();
          const val = parts[1].trim();
          whereClause = `WHERE "${col}" = '${val}'`;
        }
      }

      const sql = `SELECT * FROM public.${table} ${whereClause} ORDER BY 1 DESC LIMIT 100;`;
      const res = await executeSql(sql);

      if (!res.data) continue;

      let seen = this.seenRowKeys.get(String(i));
      if (!seen) {
        seen = new Set<string>();
        this.seenRowKeys.set(String(i), seen);
        for (const row of res.data) {
          const key = row.id || `${row.session_id}_${row.student_id}`;
          seen.add(String(key));
        }
        continue;
      }

      for (const row of res.data) {
        const key = String(row.id || `${row.session_id}_${row.student_id}`);
        if (!seen.has(key)) {
          seen.add(key);
          try {
            listener.callback({
              eventType: 'INSERT',
              new: row,
              old: null,
              table,
            });
          } catch (e) {
            console.warn('Realtime callback error:', e);
          }
        }
      }
    }
  }

  private startPolling() {
    this.poll();
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.poll();
      }, 2500);
    }
  }
}

const activeChannels = new Map<string, RealtimeChannel>();

export const db = {
  from: (tableName: string) => new QueryBuilder(tableName),
  channel: (name: string) => {
    let chan = activeChannels.get(name);
    if (!chan) {
      chan = new RealtimeChannel(name);
      activeChannels.set(name, chan);
    }
    return chan;
  },
  removeChannel: (channel: any) => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  },
};

export const useNeonClient = () => db;
