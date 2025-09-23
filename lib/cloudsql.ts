import { promises as fs } from 'fs'
import { dirname } from 'path'
import { Connector, AuthTypes, IpAddressTypes } from '@google-cloud/cloud-sql-connector'
import { GoogleAuth } from 'google-auth-library'

let proxyStarted = false
let connector: Connector | null = null
let startPromise: Promise<{ socketPath: string }> | null = null

async function startProxy() {
  const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME
  if (!instanceConnectionName) {
    throw new Error('CLOUD_SQL_CONNECTION_NAME is required when using the Cloud SQL connector')
  }
  const serviceAccount = process.env.GCP_SA_KEY
  if (!serviceAccount) {
    throw new Error('GCP_SA_KEY is required when using the Cloud SQL connector')
  }

  const socketPath = `/tmp/cloudsql/${instanceConnectionName}/.s.PGSQL.5432`
  await fs.mkdir(dirname(socketPath), { recursive: true })

  const credentials = JSON.parse(serviceAccount) as Record<string, unknown>
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/sqlservice.admin'],
    credentials,
  })

  connector = new Connector({ auth: auth as any })
  await connector.startLocalProxy({
    instanceConnectionName,
    authType: AuthTypes.PASSWORD,
    ipType: IpAddressTypes.PUBLIC,
    listenOptions: { path: socketPath },
  })
  proxyStarted = true
  return { socketPath }
}

export async function ensureCloudSqlProxy() {
  if (!startPromise) {
    startPromise = (async () => {
      const result = await startProxy()
      return result
    })().catch(error => {
      startPromise = null
      proxyStarted = false
      throw error
    })
  }
  return startPromise
}

export function shutdownCloudSqlProxy() {
  connector?.close()
  connector = null
  proxyStarted = false
  startPromise = null
}
