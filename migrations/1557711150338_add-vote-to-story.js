exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumns('story', {
    voteValueType: {
      type: 'varchar(32)',
      match: '(fibonacci|modified_fibonacci|t_shirt|power_of_2|one_to_five|one_to_ten)',
      notNull: false
    },
    voteValue: {
      type: 'varchar(32)',
      notNull: false
    }
  })
}

exports.down = (pgm) => {
  pgm.dropColumns('story', [
    'voteValueType',
    'voteValue'
  ])
}
