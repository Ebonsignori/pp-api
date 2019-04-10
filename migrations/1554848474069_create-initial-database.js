const { referencesTable } = require('./helpers')

exports.shorthands = {
  cuid: {
    type: 'varchar(36)',
    primaryKey: true,
    notNull: true,
    unique: true
  },
  option: {
    type: 'boolean',
    notNull: true,
    default: false
  },
  name: {
    type: 'varchar(32)',
    notNull: true
  },
  nullableName: {
    type: 'varchar(32)',
    notNull: false
  },
  voteType: { // Type of voting. (e.g. Fibonacci, modified fibonacci, t-shirts, powers of 2)
    type: 'varchar(32)',
    match: '(fibonacci|modified_fibonacci|t_shirt|power_of_2|one_to_five|one_to_ten)',
    notNull: true
  }
}

exports.up = (pgm) => {
  pgm.createTable('user', {
    id: 'cuid',
    isGuest: 'option',
    username: 'name',
    email: {
      type: 'varchar(255)',
      notNull: false
    },
    hasGoogleOauth: 'option',
    googleOauth: {
      type: 'varchar(255)',
      notNull: false
    },
    googleBlob: 'json',
    hasGithubOuath: 'option',
    githubOauth: {
      type: 'varchar(255)',
      notNull: false
    },
    githubBlob: 'json',
    givenName: 'name',
    familyName: 'nullableName',
    avatarUrl: {
      type: 'varchar',
      notNull: false
    },
    password: {
      type: 'varchar(128)',
      notNull: false
    },
    deleted: 'option',
    deletedAt: {
      type: 'timestamp',
      notNull: false
    },
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  })

  pgm.createTable('room', {
    id: 'cuid',
    voteValueType: 'voteType',
    activeUserIds: 'varchar(36)[]',
    revealVotes: 'option',
    useTimer: 'option',
    deleted: 'option',
    deletedAt: {
      type: 'timestamp',
      notNull: false
    },
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  })

  pgm.createTable('map_user_and_room', {
    id: 'cuid',
    userId: referencesTable('user'),
    roomId: referencesTable('room'),
    creator: 'option',
    privileges: { // Privilege level of user in room (e.g. super-admin, admin, voter, guest)
      type: 'varchar(32)',
      match: '(super_admin|admin|voter|guest)',
      notNull: true
    }
  })

  pgm.addConstraint('map_user_and_room', 'unique_user_and_room', {
    unique: ['userId', 'roomId']
  })

  pgm.createTable('story', {
    id: 'cuid',
    title: 'varchar',
    body: 'varchar',
    sourceUrl: 'varchar',
    deleted: 'option',
    deletedAt: {
      type: 'timestamp',
      notNull: false
    },
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  })

  pgm.createTable('map_room_and_story', {
    id: 'cuid',
    storyId: referencesTable('story'),
    roomId: referencesTable('room')
  })

  pgm.addConstraint('map_room_and_story', 'unique_room_and_story', {
    unique: ['storyId', 'roomId']
  })

  pgm.createTable('vote', {
    id: 'cuid',
    voteValueType: 'voteType',
    voteValue: {
      type: 'varchar(32)',
      notNull: true
    },
    storyId: referencesTable('story'),
    userId: referencesTable('user'),
    createdAt: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  })

  pgm.addConstraint('vote', 'unique_user_vote_on_story', {
    unique: ['storyId', 'userId']
  })
}

exports.down = (pgm) => {
  pgm.dropTable('vote')
  pgm.dropTable('map_room_and_story')
  pgm.dropTable('story')
  pgm.dropTable('map_user_and_room')
  pgm.dropTable('room')
  pgm.dropTable('user')
}
