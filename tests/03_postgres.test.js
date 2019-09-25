const child_process = require( 'child_process' );
const datatypes = require( '../datatypes' );
const model = require( '../model.js' );
const postgres = require( '../databases/postgres.js' );

describe( 'postgres', () => {

    beforeAll( async () => {
        child_process.execSync( 'docker -v' ); // throws if no docker installed

        try {
            child_process.execSync( 'docker rm --force --volumes databaser-test-postgres' ); // clean up any left-over container
        }
        catch( ex ) {
            // do nothing, it's ok if this failed since the container may not be orphaned to clean up
        }

        child_process.execSync( 'docker \
            run -d \
            -p 127.0.0.1:6432:5432/tcp \
            -e POSTGRES_PASSWORD=postgres \
            --health-cmd="pg_isready -U postgres" \
            --health-interval="10s" \
            --health-timeout="5s" \
            --health-start-period="10s" \
            --name databaser-test-postgres \
            postgres:latest' );

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

        const users = await postgres.get( User, {
            db: {
                host: '127.0.0.1',
                port: '6432',
                user: 'postgres',
                password: 'postgres'
            }
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

        const users = await postgres.get( User, {
            db: {
                host: '127.0.0.1',
                port: '6432',
                user: 'postgres',
                password: 'postgres'
            }
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

        const users = await postgres.get( User, {
            db: {
                host: '127.0.0.1',
                port: '6432',
                user: 'postgres',
                password: 'postgres'
            }
        } );

        await users.put( user );

        const stored_user = await users.get( user.id );

        expect( stored_user ).toEqual( user );

        await users.del( user.id );

        const deleted_user = await users.get( user.id );

        expect( deleted_user ).toEqual( undefined );

        await users.close();
    } );
} );
