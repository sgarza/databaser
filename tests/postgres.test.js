const child_process = require( 'child_process' );
const { datatypes, model, databases } = require( '../index.js' );

const db = {
	host: '127.0.0.1',
	port: '6432',
	user: 'postgres',
	password: 'postgres'
};

const POSTGRES_VERSION = '10';

describe( 'postgres', () => {

	beforeAll( async () => {
		child_process.execSync( 'docker -v' ); // throws if no docker installed

		try {
			// clean up any left-over container
			child_process.execSync( 'docker rm --force --volumes databaser-test-postgres', {
				stdio: 'ignore'
			} );
		}
		catch( ex ) {
			// do nothing, it's ok if this failed since the container may not be orphaned to clean up
		}

		child_process.execSync( `docker \
			run -d \
			-p ${ db.host }:${ db.port }:5432/tcp \
			-e POSTGRES_PASSWORD=${ db.password } \
			--health-cmd="nc -z localhost 5432" \
			--health-interval="1s" \
			--health-timeout="1s" \
			--health-start-period="1s" \
			--name databaser-test-postgres \
			postgres:${ POSTGRES_VERSION }` );

		let postgres_listening = false;
		do {
			postgres_listening = child_process.execSync( 'docker inspect --format "{{json .State.Health.Status }}" databaser-test-postgres' ).toString().trim().match( /healthy/i );
		} while( !postgres_listening );
	}, 60 * 1000 ); // 60 seconds to set up docker container

	afterAll( async () => {
		child_process.execSync( 'docker rm --force --volumes databaser-test-postgres' );
	} );

	it( 'should wait for postgres to be ready', async () => {
		const Simple = model( {
			name: 'simple',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const simples = await databases.postgres.get( Simple, {
			db,
			table: 'postgres_ready_test'
		} );

		const simple = Simple.create( {} );
		await simples.put( simple );

		const stored = await simples.get( simple.id );

		expect( stored ).toEqual( simple );

		await simples.close();
	} );

	it( 'should handle objects with only a primary key', async () => {
		const PrimaryOnly = model( {
			name: 'primaryonly',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const primary_onlys = await databases.postgres.get( PrimaryOnly, {
			db,
			table: 'primary_only_test'
		} );

		const primary_only = PrimaryOnly.create( {} );
		await primary_onlys.put( primary_only );

		const stored = await primary_onlys.get( primary_only.id );

		expect( stored ).toEqual( primary_only );

		await primary_onlys.close();
	} );

	it( 'should have a connected getter', async () => {
		const Foo = model( {
			name: 'foo',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const foos = await databases.postgres.get( Foo, {
			db,
			table: 'connected_test'
		} );

		expect( foos ).toHaveProperty( 'connected', false );

		const foo = Foo.create( {} );

		await foos.put( foo );

		expect( foos ).toHaveProperty( 'connected', true );

		await foos.close();

		expect( foos ).toHaveProperty( 'connected', false );
	} );

	it( 'should connect on calling open() and disconnect on close()', async () => {
		const Model = model( {
			name: 'testmodel',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const instances = await databases.postgres.get( Model, {
			db,
			table: 'open_test'
		} );

		expect( instances ).toHaveProperty( 'connected', false );

		await instances.open();

		expect( instances ).toHaveProperty( 'connected', true );

		await instances.close();

		expect( instances ).toHaveProperty( 'connected', false );
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

	it( 'should find a model instance with multiple options for a value (SQL OR clause)', async () => {
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
			table: 'users_find_array'
		} );

		await users.put( user );

		const stored_users = await users.find( {
			email: [
				'foo@bar.com',
				'find@domain.com',
				'baz@yak.com'
			]
		} );

		expect( Array.isArray( stored_users ) ).toBe( true );
		expect( Array.isArray( stored_users ) && stored_users.length ).toBe( 1 );
		expect( Array.isArray( stored_users ) && stored_users.length && stored_users[ 0 ] ).toEqual( user );

		await users.close();
	} );

	it( 'should sort multiple results properly', async () => {
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
				created_at: datatypes.ISODate()
			}
		} );

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_find_and_sort'
		} );

		const created_users = [];
		for ( let index = 0; index < 5; ++index ) {
			const user = User.create( {
				email: `find_and_sort_${ index }@domain.com`
			} );

			created_users.push( user );

			await users.put( user );
		}

		const descending_created_users = [ ...created_users ].sort( ( lhs, rhs ) => -1 * lhs.created_at.localeCompare( rhs.created_at ) );
		const ascending_created_users = [ ...created_users ].sort( ( lhs, rhs ) => lhs.created_at.localeCompare( rhs.created_at ) );

		const descending_found_users = await users.find( {}, {
			order: {
				column: 'created_at',
				sort: 'desc'
			}
		} );

		const ascending_found_users = await users.find( {}, {
			order: {
				column: 'created_at',
				sort: 'asc'
			}
		} );

		expect( Array.isArray( descending_found_users ) ).toBe( true );
		expect( Array.isArray( ascending_found_users ) ).toBe( true );

		expect( descending_found_users ).toEqual( descending_created_users );
		expect( ascending_found_users ).toEqual( ascending_created_users );

		await users.close();
	} );

	it( 'should support paths for ordering column', async () => {
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
				timestamps: {
					created: datatypes.ISODate()
				}
			}
		} );

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_find_and_sort_with_column_path'
		} );

		const created_users = [];
		for ( let index = 0; index < 5; ++index ) {
			const user = User.create( {
				email: `find_and_sort_with_column_path_${ index }@domain.com`
			} );

			created_users.push( user );

			await users.put( user );
		}

		const descending_created_users = [ ...created_users ].sort( ( lhs, rhs ) => -1 * lhs.timestamps.created.localeCompare( rhs.timestamps.created ) );
		const ascending_created_users = [ ...created_users ].sort( ( lhs, rhs ) => lhs.timestamps.created.localeCompare( rhs.timestamps.created ) );

		const descending_found_users = await users.find( {}, {
			order: {
				column: [ 'timestamps', 'created' ],
				sort: 'desc'
			}
		} );

		const ascending_found_users = await users.find( {}, {
			order: {
				column: [ 'timestamps', 'created' ],
				sort: 'asc'
			}
		} );

		expect( Array.isArray( descending_found_users ) ).toBe( true );
		expect( Array.isArray( ascending_found_users ) ).toBe( true );

		expect( descending_found_users ).toEqual( descending_created_users );
		expect( ascending_found_users ).toEqual( ascending_created_users );

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
		expect( smallint_table_create_sql ).toMatch( 'val SMALLINT' );

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
		expect( integer_table_create_sql ).toMatch( 'val INTEGER' );

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
		expect( bigint_table_create_sql ).toMatch( 'val BIGINT' );

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
		expect( unspecified_table_create_sql ).toMatch( 'val INTEGER' );
	} );

	it( 'should serialize/deserialize a JSON object properly', async () => {
		const JSONObject = model( {
			name: 'jsonobject',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.JSON( {
					initial: {}
				} )
			}
		} );

		const jsonobject = JSONObject.create( {
			val: {
				foo: 'bar'
			}
		} );

		const jsonobjects = await databases.postgres.get( JSONObject, {
			db,
			table: 'jsonobjects'
		} );

		await jsonobjects.put( jsonobject );

		const stored = await jsonobjects.get( jsonobject.id );

		expect( stored.val ).toEqual( {
			foo: 'bar'
		} );

		await jsonobjects.close();
	} );

	it( 'should serialize/deserialize a JSON array properly', async () => {
		const JSONArray = model( {
			name: 'jsonarray',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.JSON( {
					initial: []
				} )
			}
		} );

		const jsonarray = JSONArray.create( {
			val: [ 1, 2, 3 ]
		} );

		const jsonarrays = await databases.postgres.get( JSONArray, {
			db,
			table: 'jsonarrays'
		} );

		await jsonarrays.put( jsonarray );

		const stored = await jsonarrays.get( jsonarray.id );

		expect( stored.val ).toEqual( [ 1, 2, 3 ] );

		await jsonarrays.close();
	} );

	it( 'should serialize/deserialize a boolean properly', async () => {
		const TestModel = model( {
			name: 'boolean_test',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				value: datatypes.boolean()
			}
		} );

		const test = TestModel.create( {
			value: true
		} );

		const tests = await databases.postgres.get( TestModel, {
			db,
			table: 'datatypes_boolean'
		} );

		await tests.put( test );

		const stored = await tests.get( test.id );

		expect( stored ).toEqual( test );

		await tests.close();
	} );

	it( 'should serialize/deserialize a number properly', async () => {
		const TestModel = model( {
			name: 'number_test',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				value: datatypes.number()
			}
		} );

		const test = TestModel.create( {
			value: Math.random() * 1000
		} );

		const tests = await databases.postgres.get( TestModel, {
			db,
			table: 'datatypes_number'
		} );

		await tests.put( test );

		const stored = await tests.get( test.id );

		expect( stored ).toEqual( test );

		await tests.close();
	} );

	it( 'should support column_type_overrides', async () => {
		const Model = model( {
			name: 'testoverrides',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				foo: datatypes.JSON( {
					initial: null
				} )
			}
		} );

		const instances = await databases.postgres.get( Model, {
			db,
			table: 'column_type_overrides_test',
			column_type_overrides: {
				foo: 'TEXT'
			},
			serializers: {
				foo: JSON.stringify.bind( JSON )
			},
			deserializers: {
				foo: JSON.parse.bind( JSON )
			}
		} );

		const table_create_sql = instances._create_table_sql();
		expect( table_create_sql ).toMatch( 'foo TEXT' );

		const test = Model.create( {
			foo: {
				blah: true
			}
		} );

		await instances.put( test );

		const stored = await instances.get( test.id );

		expect( stored ).toEqual( test );

		await instances.close();
	} );

	it( 'should support async serialize/deserialize', async () => {
		const Model = model( {
			name: 'testasyncserialization',
			schema: {
				id: datatypes.UUID( {
					null: false,
					unique: true,
					primary: true
				} ),
				foo: datatypes.string( {
					initial: null
				} )
			}
		} );

		async function sleep( ms ) {
			return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
		}

		const instances = await databases.postgres.get( Model, {
			db,
			table: 'async_serialization_test',
			serializers: {
				foo: async function( value ) {
					await sleep( 1000 );
					return value.split( '' ).reverse().join( '' );
				}
			},
			deserializers: {
				foo: async function( serialized ) {
					await sleep( 1000 );
					return serialized.split( '' ).reverse().join( '' );
				}
			}
		} );

		const test = Model.create( {
			foo: 'blah'
		} );

		await instances.put( test );

		const stored = await instances.get( test.id );

		expect( stored ).toEqual( test );

		await instances.close();
	} );
} );
