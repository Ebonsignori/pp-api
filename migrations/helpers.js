const referencesTable = (table) => {
  return {
    type: 'varchar(36)',
    references: `"${table}" (id)`,
    notNull: true
  }
}

module.exports = {
  referencesTable
}
