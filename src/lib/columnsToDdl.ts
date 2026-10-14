function delimiterOf(line: string) {
  const commas = (line.match(/,/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  const tabs = (line.match(/\t/g) ?? []).length
  if (tabs > commas && tabs >= semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

function quoteIdent(name: string) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name
  return `"${name.replace(/"/g, '""')}"`
}

export function columnsToDdl(tableName: string, header: string) {
  const line = header
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean)
  if (!line) return { sql: '', error: 'Add at least one column name.' }
  if (/create\s+table/i.test(header)) return { sql: header.trim(), error: null }

  const seen = new Map<string, number>()
  const names = line
    .split(delimiterOf(line))
    .map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .map((name) => {
      const count = (seen.get(name.toLowerCase()) ?? 0) + 1
      seen.set(name.toLowerCase(), count)
      return count === 1 ? name : `${name}_${count}`
    })
  if (!names.length) return { sql: '', error: 'Add at least one column name.' }

  const table = tableName.trim() || 'dataset'
  const body = names.map((name) => `  ${quoteIdent(name)} TEXT`).join(',\n')
  return { sql: `CREATE TABLE ${quoteIdent(table)} (\n${body}\n);`, error: null }
}
