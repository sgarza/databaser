'use strict';

const datatypes = require( './datatypes' );
const model = require( './model.js' );
const postgres = require( './databases/postgres.js' );

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
        phone: datatypes.phone( {
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
        address: {
            street: datatypes.string( {
                initial: null
            } ),
            city: datatypes.string( {
                initial: null
            } ),
            state: datatypes.string( {
                length: {
                    min: 2,
                    max: 2
                },
                initial: null
            } ),
            zipcode: datatypes.string( {
                length: {
                    min: 5,
                    max: 5
                },
                initial: null
            } )
        },
        birthdate: datatypes.string( {
            initial: null
        } ),
        ssn4: datatypes.string( {
            length: {
                min: 4,
                max: 4
            },
            initial: null
        } ),
        username: datatypes.string( {
            initial: null
        } ),
        meta: datatypes.json( {
            initial: {}
        } ),
        created_at: datatypes.ISODate(),
        updated_at: datatypes.ISODate(),
        deleted_at: datatypes.ISODate( {
            initial: null
        } )
    }
} );

( async () => {
    const user = User.create( {
        email: 'f'
    } );

    console.dir( user );

    console.log( '' );
    console.log( '' );

    console.log( 'validate:' );
    console.dir( User.validate( user ) );

    console.log( '' );
    console.log( '' );

    console.log( 'postgres:' );
    const users = await postgres.get( User );
    console.dir( users );
    console.log( '' );

    console.dir( await users.put( user ) );
    console.dir( await users.get( 'foo' ) );
    console.dir( await users.find( {
        phone: '123',
        name: {
            first: 'fooooooo'
        }
    } ) );
    console.dir( await users.del( 'foo' ) );

    // console.log( 'sqlite:' );
    // console.dir( User.db.initialization.table( 'sqlite' ) );
    // console.log( '' );

    // console.log( 'mysql:' );
    // console.dir( User.db.initialization.table( 'mysql' ) );
    // console.log( '' );
} )();