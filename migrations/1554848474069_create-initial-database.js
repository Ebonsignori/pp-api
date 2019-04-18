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
  nullableName: {
    type: 'varchar(32)',
    notNull: false
  },
  voteType: { // Type of voting. (e.g. Fibonacci, modified fibonacci, t-shirts, powers of 2)
    type: 'varchar(32)',
    match: '(fibonacci|modified_fibonacci|t_shirt|power_of_2|one_to_five|one_to_ten)',
    notNull: true
  },
  mapId: {
    type: 'varchar(36)',
    primaryKey: true,
    notNull: true,
    unique: true
  }
}

exports.up = (pgm) => {
  pgm.createTable('user', {
    id: 'cuid',
    isGuest: 'option',
    username: {
      type: 'varchar(32)',
      notNull: true,
      unique: true
    },
    email: {
      type: 'varchar(255)',
      notNull: false,
      unique: true
    },
    googleOauthId: {
      type: 'varchar(255)',
      notNull: false,
      unique: true
    },
    googleOauthAccess: {
      type: 'varchar(255)',
      notNull: false
    },
    googleOauthRefresh: {
      type: 'varchar(255)',
      notNull: false
    },
    githubOauthId: {
      type: 'varchar(255)',
      notNull: false,
      unique: true
    },
    githubOauthAccess: {
      type: 'varchar(255)',
      notNull: false
    },
    githubOauthRefresh: {
      type: 'varchar(255)',
      notNull: false
    },
    givenName: 'nullableName',
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
    name: {
      type: 'varchar(32)',
      notNull: true
    },
    voteValueType: 'voteType',
    revealVotes: 'option',
    useTimer: 'option',
    allowRevote: 'option',
    allowGuests: 'option',
    allowedUsers: {
      type: 'json',
      notNull: false
    },
    whoCanStart: {
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
      notNull: true
    },
    whoCanVote: {
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
      notNull: true
    },
    whoCanEnd: {
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
      notNull: true
    },
    whoCanRevote: {
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
      notNull: true
    },
    whoCanDecide: {
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
      notNull: true
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

  pgm.createTable('map_user_and_room', {
    isActive: 'option',
    userId: referencesTable('user'),
    roomId: referencesTable('room'),
    privileges: { // Privilege level of user in room
      type: 'varchar(32)',
      match: '(admin|creator|user|guest)',
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
    isFromGithub: 'option',
    githubIssueLabel: {
      type: 'varchar',
      notNull: false
    },
    githubIssueId: {
      type: 'varchar(255)',
      notNull: false
    },
    githubIssueOwner: {
      type: 'varchar(255)',
      notNull: false
    },
    githubIssueRepo: {
      type: 'varchar(255)',
      notNull: false
    },
    githubIssueNumber: {
      type: 'varchar(255)',
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

  pgm.createTable('map_room_and_story', {
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
