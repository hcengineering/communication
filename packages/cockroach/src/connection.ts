//Full copy from @hcengineering/postgres
import postgres from 'postgres'
import { v4 as uuid } from 'uuid'

const connections = new Map<string, PostgresClientReferenceImpl>()
const clientRefs = new Map<string, ClientRef>()

export interface PostgresClientReference {
  getClient: () => Promise<postgres.Sql>
  close: () => void
}

class PostgresClientReferenceImpl {
  count: number
  client: postgres.Sql | Promise<postgres.Sql>

  constructor(
    client: postgres.Sql | Promise<postgres.Sql>,
    readonly onclose: () => void
  ) {
    this.count = 0
    this.client = client
  }

  async getClient(): Promise<postgres.Sql> {
    if (this.client instanceof Promise) {
      this.client = await this.client
    }
    return this.client
  }

  close(force: boolean = false): void {
    this.count--
    if (this.count === 0 || force) {
      if (force) {
        this.count = 0
      }
      void (async () => {
        this.onclose()
        const cl = await this.client
        await cl.end()
        console.log('Closed postgres connection')
      })()
    }
  }

  addRef(): void {
    this.count++
    console.log('Add postgres connection', this.count)
  }
}

export class ClientRef implements PostgresClientReference {
  id = uuid()
  constructor(readonly client: PostgresClientReferenceImpl) {
    clientRefs.set(this.id, this)
  }

  closed = false
  async getClient(): Promise<postgres.Sql> {
    if (!this.closed) {
      return await this.client.getClient()
    } else {
      throw new Error('DB client-query is already closed')
    }
  }

  close(): void {
    // Do not allow double close of connection client-query
    if (!this.closed) {
      clientRefs.delete(this.id)
      this.closed = true
      this.client.close()
    }
  }
}

export function connect(connectionString: string, database?: string): PostgresClientReference {
  const extraOptions = JSON.parse(process.env.POSTGRES_OPTIONS ?? '{}')
  const key = `${connectionString}${extraOptions}`
  let existing = connections.get(key)

  if (existing === undefined) {
    const sql = postgres(connectionString, {
      connection: {
        application_name: 'communication'
      },
      database,
      max: 10,
      fetch_types: false,
      prepare: false,
      types: {
        // https://jdbc.postgresql.org/documentation/publicapi/constant-values.html
        int8: {
          to: 0,
          from: [20],
          parse: (value: number) => Number(value)
        },
        timestamp: {
          to: 0,
          from: [1114, 1184],
          parse: (value: string) => new Date(value)
        }
      },
      ...extraOptions
    })

    existing = new PostgresClientReferenceImpl(sql, () => {
      connections.delete(key)
    })
    connections.set(key, existing)
  }
  // Add reference and return once closable
  existing.addRef()
  return new ClientRef(existing)
}
