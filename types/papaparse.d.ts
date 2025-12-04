declare module 'papaparse' {
  interface ParseError {
    message: string
    [key: string]: unknown
  }

  interface ParseResult<T> {
    data: T[]
    errors: ParseError[]
    meta: Record<string, unknown>
  }

  interface ParseConfig {
    skipEmptyLines?: boolean | 'greedy'
    [key: string]: unknown
  }

  export function parse<T>(input: string | File | Blob, config?: ParseConfig): ParseResult<T>

  const Papa: {
    parse<T>(input: string | File | Blob, config?: ParseConfig): ParseResult<T>
    [key: string]: unknown
  }

  export default Papa
}
