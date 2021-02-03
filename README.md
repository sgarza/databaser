# databaser

## Example

```javascript
'use strict';

const {
	as_json_schema,
	databases,
	datatypes,
	model
} = require( 'databaser' );

const User = model( {
	name: 'user',
	schema: {
		id: datatypes.UUID( {
			nullable: false,
			unique: true,
			primary: true
		} ),
		email: datatypes.email( {
			initial: null,
			index: true // add a basic index for this column
		} ),
		name: {
			first: datatypes.string( {
				initial: null
			} ),
			last: datatypes.string( {
				initial: null
			} )
		},
		meta: datatypes.JSON(),
		timestamps: {
			created: datatypes.ISODate(),
			updated: datatypes.ISODate(),
			deleted: datatypes.ISODate( {
				initial: null
			} )
		},
		unstored: datatypes.string( {
			nullable: true,
			initial: null,
			example: 'hello',
			stored: false
		} ),
		not_in_json_schema: datatypes.string( {
			nullable: true,
			initial: null,
			example: 'not here',
			json_schema: false
		} )
	}
} );

( async () => {
	const user = User.create( {
		email: 'foo@bar.com',
		name: {
			first: 'Foo',
			last: 'Bar'
		}
	} );

	console.dir( user );

	const validation_errors = User.validate( user );
	if ( validation_errors.length ) {
		throw new Error( `Invalid user:
		${ JSON.stringify( validation_errors, null, 4 ) ) }
		` );
	}

	// for the example's sake, we could store the 'meta' field as another type
	// with column_type_overrides/serializers/deserializers, eg:
	const users_db = await databases.postgres.get( User, {
		column_type_overrides: {
			meta: 'TEXT'
		},
		serializers: {
			meta: JSON.stringify.bind( JSON )
		},
		deserializers: {
			meta: JSON.parse.bind( JSON )
		}
	} );
	await users_db.put( user );

	const fetched_user = await users_db.get( user.id );
	console.log( `Fetched same user: ${ fetched_user && fetched_user.id === user.id }` );

	const found_user = await users_db.find( {
		email: 'foo@bar.com'
	} );
	console.log( `Found same user: ${ found_user && found_user.id === user.id }` );

	const newest_user = await users_db.find( {}, {
		limit: 1,
		order: {
			column: [ 'timestamps', 'created' ],
			sort: 'desc'
		}
	} );
	console.log( `Found newest user: ${ newest_user.id }` );

	const first_email_user = await users_db.find( {}, {
		limit: 1,
		order: {
			column: 'email',
			sort: 'asc'
		}
	} );
	console.log( `Found user with first lexical email: ${ first_email_user.id }` );

	await users_db.del( user.id );
	console.log( 'Deleted user from db.' );

	// we can convert to a json schema, as well
	console.dir( as_json_schema( User ) );
} )();
```