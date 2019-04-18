const referencesTable = (table) => {
  return {
    type: 'varchar(36)',
    references: `"${table}" (id)`,
    primaryKey: true,
    notNull: true
  }
}

module.exports = {
  referencesTable
}
