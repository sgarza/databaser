const child_process = require( 'child_process' );
const { datatypes, model, databases } = require( '../index.js' );

const db = {
    host: '127.0.0.1',
    port: '6432',
    user: 'postgres',
    password: 'postgres'
};

describe( 'postgres', () => {

    beforeAll( async () => {
        child_process.execSync( 'docker -v' ); // throws if no docker installed

        try {
            child_process.execSync( 'docker rm --force --volumes databaser-test-postgres' ); // clean up any left-over container
        }
        catch( ex ) {
            // do nothing, it's ok if this failed since the container may not be orphaned to clean up
        }

        child_process.execSync( `docker \
            run -d \
            -p ${ db.host }:${ db.port }:5432/tcp \
            -e POSTGRES_PASSWORD=${ db.password } \
            --health-cmd="pg_isready -U ${ db.user }" \
            --health-interval="10s" \
            --health-timeout="5s" \
            --health-start-period="10s" \
            --name databaser-test-postgres \
            postgres:latest` );

        let postgres_ready = false;
        do {
            postgres_ready = child_process.execSync( 'docker inspect --format "{{json .State.Health.Status }}" databaser-test-postgres' ).toString().trim().match( /healthy/i );
        } while( !postgres_ready );
    }, 60 * 1000 ); // 60 seconds to set up docker container

    afterAll( async () => {
        child_process.execSync( 'docker rm --force --volumes databaser-test-postgres' );
    } );

    it( 'should store a model instance', async () => {
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
                } )
            }
        } );

        const user = User.create( {
            email: 'foo@bar.com'
        } );

        const users = await databases.postgres.get( User, {
            db,
            table: 'users_store'
        } );

        await users.put( user );

        const stored_user = await users.get( user.id );

        expect( stored_user ).toEqual( user );

        await users.close();
    } );

    it( 'should find a model instance', async () => {
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
                } )
            }
        } );

        const user = User.create( {
            email: 'find@domain.com'
        } );

        const users = await databases.postgres.get( User, {
            db,
            table: 'users_find'
        } );

        await users.put( user );

        const stored_users = await users.find( {
            email: 'find@domain.com'
        } );

        expect( Array.isArray( stored_users ) ).toBe( true );
        expect( Array.isArray( stored_users ) && stored_users.length ).toBe( 1 );
        expect( Array.isArray( stored_users ) && stored_users.length && stored_users[ 0 ] ).toEqual( user );

        await users.close();
    } );

    it( 'should delete a model instance', async () => {
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
                } )
            }
        } );

        const user = User.create( {
            email: 'deletable@domain.com'
        } );

        const users = await databases.postgres.get( User, {
            db,
            table: 'users_delete'
        } );

        await users.put( user );

        const stored_user = await users.get( user.id );

        expect( stored_user ).toEqual( user );

        await users.del( user.id );

        const deleted_user = await users.get( user.id );

        expect( deleted_user ).toEqual( undefined );

        await users.close();
    } );

    it( 'should serialize/deserialize an ISODate properly', async () => {
        const User = model( {
            name: 'user',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                created_at: datatypes.ISODate()
            }
        } );

        const user = User.create();

        const users = await databases.postgres.get( User, {
            db,
            table: 'users_isodate_serialization'
        } );

        await users.put( user );

        const stored_user = await users.get( user.id );

        expect( stored_user ).toEqual( user );

        await users.close();
    } );

    it( 'should serialize/deserialize an ISODate in UTC properly', async () => {

        const PREV_TZ = process.env.TZ;
        process.env.TZ = 'utc';

        const User = model( {
            name: 'user',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                created_at: datatypes.ISODate()
            }
        } );

        const user = User.create();

        const users = await databases.postgres.get( User, {
            db,
            table: 'users_isodate_utc_serialization'
        } );

        await users.put( user );

        const stored_user = await users.get( user.id );

        expect( stored_user ).toEqual( user );

        await users.close();

        process.env.TZ = PREV_TZ;
    } );

    it( 'should determine integer types properly', async () => {
        const Smallint = model( {
            name: 'smallint_test',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                val: datatypes.integer( {
                    range: {
                        min: -1000,
                        max: 1000
                    }
                } )
            }
        } );

        const smallints = await databases.postgres.get( Smallint, {
            db,
            table: 'smallint_test_store'
        } );

        const smallint_table_create_sql = smallints._create_table_sql();
        expect( smallint_table_create_sql ).toMatch( 'val smallint' );

        const Integer = model( {
            name: 'integer_test',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                val: datatypes.integer( {
                    range: {
                        min: -100000,
                        max: 100000
                    }
                } )
            }
        } );

        const integers = await databases.postgres.get( Integer, {
            db,
            table: 'integer_test_store'
        } );

        const integer_table_create_sql = integers._create_table_sql();
        expect( integer_table_create_sql ).toMatch( 'val integer' );

        const Bigint = model( {
            name: 'bigint_test',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                val: datatypes.integer( {
                    range: {
                        min: -10000000000,
                        max: 10000000000
                    }
                } )
            }
        } );

        const bigints = await databases.postgres.get( Bigint, {
            db,
            table: 'bigint_test_store'
        } );

        const bigint_table_create_sql = bigints._create_table_sql();
        expect( bigint_table_create_sql ).toMatch( 'val bigint' );

        const Unspecified = model( {
            name: 'unspecified_range_test',
            schema: {
                id: datatypes.UUID( {
                    null: false,
                    unique: true,
                    primary: true
                } ),
                val: datatypes.integer()
            }
        } );

        const unspecifieds = await databases.postgres.get( Unspecified, {
            db,
            table: 'unspecified_test_store'
        } );

        const unspecified_table_create_sql = unspecifieds._create_table_sql();
        expect( unspecified_table_create_sql ).toMatch( 'val integer' );
    } );
} );
