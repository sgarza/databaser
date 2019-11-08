# databaser

## Example

```javascript
'use strict';

const { model, databases, datatypes } = require( 'databaser' );

const User = model( {
    name: 'user',
    schema: {
        id: datatypes.UUID( {
            null: false,
            unique: true,
            primary: true
        } ),
        email: datatypes.email( {
            initial: null
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
        created_at: datatypes.ISODate(),
        updated_at: datatypes.ISODate(),
        deleted_at: datatypes.ISODate( {
            initial: null
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

    const fetched_user = await users.get( user.id );
    console.log( `Fetched same user: ${ fetched_user && fetched_user.id === user.id }` );

    const found_user = await users.find( {
        email: 'foo@bar.com'
    } );
    console.log( `Found same user: ${ found_user && found_user.id === user.id }` );

    await users.del( user.id );
    console.log( 'Deleted user from db.' );
} )();
```