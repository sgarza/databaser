'use strict';

const assert = require( 'assert' );
const child_process = require( 'child_process' );
const { datatypes, model, databases } = require( '../index.js' );

const db = {
	host: '127.0.0.1',
	port: '6432',
	user: 'postgres',
	password: 'postgres'
};

const POSTGRES_VERSION = '12';

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'postgres' );

	group.before.all.push( async () => {
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

		// don't wait for this to come up specifically so the postgres tests will exercise
		// the automatic connection waiting behavior
		child_process.exec( `docker \
			run -d \
			-p ${ db.host }:${ db.port }:5432/tcp \
			-e POSTGRES_PASSWORD=${ db.password } \
			--health-cmd="nc -z localhost 5432" \
			--health-interval="1s" \
			--health-timeout="1s" \
			--health-start-period="1s" \
			--name databaser-test-postgres \
			postgres:${ POSTGRES_VERSION }` );

		// let postgres_listening = false;
		// do {
		// 	postgres_listening = child_process.execSync( 'docker inspect --format "{{json .State.Health.Status }}" databaser-test-postgres' ).toString().trim().match( /healthy/i );
		// } while( !postgres_listening );
	} );

	group.after.all.push( async () => {
		child_process.execSync( 'docker rm --force --volumes databaser-test-postgres' );
	} );

	group.test( 'should wait for postgres to be ready', async () => {
		const Simple = model( {
			name: 'simple',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored, simple );

		await simples.close();
	} );

	group.test( 'should handle objects with only a primary key', async () => {
		const PrimaryOnly = model( {
			name: 'primaryonly',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored, primary_only );

		await primary_onlys.close();
	} );

	group.test( 'should have a connected getter', async () => {
		const Foo = model( {
			name: 'foo',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const foos = await databases.postgres.get( Foo, {
			db,
			table: 'connected_test'
		} );

		assert.strictEqual( foos?.connected, false );

		const foo = Foo.create( {} );

		await foos.put( foo );

		assert.strictEqual( foos?.connected, true );

		await foos.close();

		assert.strictEqual( foos?.connected, false );
	} );

	group.test( 'should connect on calling open() and disconnect on close()', async () => {
		const Model = model( {
			name: 'testmodel',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} )
			}
		} );

		const instances = await databases.postgres.get( Model, {
			db,
			table: 'open_test'
		} );

		assert.strictEqual( instances.connected, false );

		await instances.open();

		assert.strictEqual( instances.connected, true );

		await instances.close();

		assert.strictEqual( instances.connected, false );
	} );

	group.test( 'should store a model instance', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored_user, user );

		await users.close();
	} );

	group.test( 'should not store fields with stored: false', async () => {
		const Unstored_Fields = model( {
			name: 'unstored_fields',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer( {
					initial: 123,
					stored: false
				} )
			}
		} );

		const test_db = await databases.postgres.get( Unstored_Fields, {
			db,
			table: 'unstored_fields_test_table'
		} );

		const table_create_sql = test_db._create_table_sql();
		assert.ok( !/val/.test( table_create_sql ) );

		const test = Unstored_Fields.create( {} );
		assert.strictEqual( test.val, 123 );

		await test_db.put( test );

		const found = await test_db.get( test.id );
		assert.ok( found );
		assert.strictEqual( found.val, 123 );

		await test_db.close();
	} );

	group.test( 'should find a model instance', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		const stored_user = await users.find( {
			email: 'find@domain.com'
		} );

		assert.ok( stored_user );
		assert.deepStrictEqual( stored_user, user );

		await users.close();
	} );

	group.test( 'should find a model instance with multiple options for a value', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
			table: 'users_find_array',
			debug: false
		} );

		await users.put( user );

		const stored_users = await users.all( {
			email: [
				'foo@bar.com',
				'find@domain.com',
				'baz@yak.com'
			]
		} );

		assert.strictEqual( Array.isArray( stored_users ), true );
		assert.strictEqual( Array.isArray( stored_users ) && stored_users.length, 1 );
		assert.deepStrictEqual( Array.isArray( stored_users ) && stored_users.length && stored_users[ 0 ], user );

		await users.close();
	} );

	group.test( 'should find a model instance with when searching for a null value', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				email: datatypes.email( {
					initial: null
				} )
			}
		} );

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_find_by_null'
		} );

		for ( let i = 0; i < 5; ++i ) {
			const user = User.create( {} );
			await users.put( user );
		}

		for ( let i = 0; i < 5; ++i ) {
			const user = User.create( {
				email: `${ i }@test.com`
			} );
			await users.put( user );
		}

		const null_email_users = await users.all( {
			email: null
		} );

		assert.strictEqual( Array.isArray( null_email_users ), true );
		assert.strictEqual( null_email_users?.length, 5 );

		await users.close();
	} );

	group.test( 'should find a model instance with advanced query on a value', async () => {
		const Count = model( {
			name: 'count',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				count: datatypes.integer()
			}
		} );

		const counts = await databases.postgres.get( Count, {
			db,
			table: 'count_find_advanced',
			debug: false
		} );

		for ( let i = 0; i < 10; ++i ) {
			const count = Count.create( {
				count: i
			} );
			await counts.put( count );
		}

		const matching_counts_with_and = await counts.all( {
			count: {
				and: [ {
					comparison: '>',
					value: 2
				}, {
					comparison: '<',
					value: 8
				} ]
			}
		} );

		assert.strictEqual( Array.isArray( matching_counts_with_and ), true );
		assert.strictEqual( Array.isArray( matching_counts_with_and ) && matching_counts_with_and.length, 5 ); // 3, 4, 5, 6, 7
		assert.deepStrictEqual( Array.isArray( matching_counts_with_and ) && matching_counts_with_and.map( ( _count ) => ( _count.count ) ).sort(), [ 3, 4, 5, 6, 7 ] );

		const matching_counts_with_or = await counts.all( {
			count: {
				or: [ {
					comparison: '<',
					value: 2
				}, {
					comparison: '>',
					value: 8
				} ]
			}
		} );

		assert.strictEqual( Array.isArray( matching_counts_with_or ), true );
		assert.strictEqual( Array.isArray( matching_counts_with_or ) && matching_counts_with_or.length, 3 ); // 0, 1, 9
		assert.deepStrictEqual( Array.isArray( matching_counts_with_or ) && matching_counts_with_or.map( ( _count ) => ( _count.count ) ).sort(), [ 0, 1, 9 ] );

		const matching_counts_with_not_scalar = await counts.all( {
			count: {
				not: 5
			}
		} );

		assert.strictEqual( Array.isArray( matching_counts_with_not_scalar ), true );
		assert.strictEqual( Array.isArray( matching_counts_with_not_scalar ) && matching_counts_with_not_scalar.length, 9 ); // 0, 1, 2, 3, 4, 6, 7, 8, 9
		assert.deepStrictEqual( Array.isArray( matching_counts_with_not_scalar ) && matching_counts_with_not_scalar.map( ( _count ) => ( _count.count ) ).sort(), [ 0, 1, 2, 3, 4, 6, 7, 8, 9 ] );

		const matching_counts_with_not_array = await counts.all( {
			count: {
				not: [ 1, 3, 5, 7, 9 ]
			}
		} );

		assert.strictEqual( Array.isArray( matching_counts_with_not_array ), true );
		assert.strictEqual( Array.isArray( matching_counts_with_not_array ) && matching_counts_with_not_array.length, 5 ); // 0, 2, 4, 6, 8
		assert.deepStrictEqual( Array.isArray( matching_counts_with_not_array ) && matching_counts_with_not_array.map( ( _count ) => ( _count.count ) ).sort(), [ 0, 2, 4, 6, 8 ] );

		const matching_counts_with_value_comparison = await counts.all( {
			count: {
				comparison: '>',
				value: 5
			}
		} );

		assert.strictEqual( Array.isArray( matching_counts_with_value_comparison ), true );
		assert.strictEqual( Array.isArray( matching_counts_with_value_comparison ) && matching_counts_with_value_comparison.length, 4 ); // 6, 7, 8, 9
		assert.deepStrictEqual( Array.isArray( matching_counts_with_value_comparison ) && matching_counts_with_value_comparison.map( ( _count ) => ( _count.count ) ).sort(), [ 6, 7, 8, 9 ] );

		await counts.close();
	} );

	group.test( 'should find a model instance with advanced query on a value', async () => {
		const Value = model( {
			name: 'nulls',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				value: datatypes.string( {
					initial: null
				} ),
				other_value: datatypes.string( {
					initial: 'other'
				} )
			}
		} );

		const values = await databases.postgres.get( Value, {
			db,
			table: 'nulls',
			debug: false
		} );

		for ( let i = 0; i < 10; ++i ) {
			const value = Value.create( {
				value: i % 2 === 0 ? null : `${ i }`
			} );
			await values.put( value );
		}

		const matching_nulls = await values.all( {
			value: null
		} );

		assert.strictEqual( Array.isArray( matching_nulls ), true );
		assert.strictEqual( Array.isArray( matching_nulls ) && matching_nulls.length, 5 );
		assert.deepStrictEqual( Array.isArray( matching_nulls ) && matching_nulls.map( ( _null ) => ( _null.value ) ).sort(), [ null, null, null, null, null ] );

		const matching_not_nulls = await values.all( {
			value: {
				not: null
			}
		} );

		assert.strictEqual( Array.isArray( matching_not_nulls ), true );
		assert.strictEqual( Array.isArray( matching_not_nulls ) && matching_not_nulls.length, 5 );
		assert.deepStrictEqual( Array.isArray( matching_not_nulls ) && matching_not_nulls.map( ( _not_null ) => ( _not_null.value ) ).sort(), [ '1', '3', '5', '7', '9' ] );

		// we ensure we can pass another value while searching for nulls
		// to avoid a regression around a null value causing an off-by-one
		// with substitutions
		const matching_mixed = await values.all( {
			value: null,
			other_value: 'other'
		} );

		assert.strictEqual( Array.isArray( matching_mixed ), true );
		assert.strictEqual( Array.isArray( matching_mixed ) && matching_mixed.length, 5 );
		assert.deepStrictEqual( Array.isArray( matching_mixed ) && matching_mixed.map( ( _null ) => ( _null.value ) ).sort(), [ null, null, null, null, null ] );

		try {
			await values.all( {
				value: {
					not: [ null, 1, 2, 3 ]
				}
			} );
	
			assert.fail( 'allowed passing null in an array of not values' );
		}
		catch ( error ) {
			assert.strictEqual( error?.toString(), 'Error: cannot include null in array of values with not' );
		}

		await values.close();
	} );

	group.test( 'should sort multiple results properly', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		const descending_found_users = await users.all( {}, {
			order: {
				column: 'created_at',
				sort: 'desc'
			}
		} );

		const ascending_found_users = await users.all( {}, {
			order: {
				column: 'created_at',
				sort: 'asc'
			}
		} );

		assert.strictEqual( Array.isArray( descending_found_users ), true );
		assert.strictEqual( Array.isArray( ascending_found_users ), true );

		assert.deepStrictEqual( descending_found_users, descending_created_users );
		assert.deepStrictEqual( ascending_found_users, ascending_created_users );

		await users.close();
	} );

	group.test( 'should support paths for ordering column', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		const descending_found_users = await users.all( {}, {
			order: {
				column: [ 'timestamps', 'created' ],
				sort: 'desc'
			}
		} );

		const ascending_found_users = await users.all( {}, {
			order: {
				column: [ 'timestamps', 'created' ],
				sort: 'asc'
			}
		} );

		assert.strictEqual( Array.isArray( descending_found_users ), true );
		assert.strictEqual( Array.isArray( ascending_found_users ), true );

		assert.deepStrictEqual( descending_found_users, descending_created_users );
		assert.deepStrictEqual( ascending_found_users, ascending_created_users );

		await users.close();
	} );

	group.test( 'should delete a model instance', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored_user, user );

		await users.del( user.id );

		const deleted_user = await users.get( user.id );

		assert.strictEqual( deleted_user, undefined );

		await users.close();
	} );

	group.test( 'should serialize/deserialize a date properly', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				created_on: datatypes.date()
			}
		} );

		const user = User.create();

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_date_serialization'
		} );

		await users.put( user );

		const stored_user = await users.get( user.id );

		assert.deepStrictEqual( stored_user, user );

		await users.close();
	} );

	group.test( 'should serialize/deserialize a date in UTC properly', async () => {

		const PREV_TZ = process.env.TZ;
		process.env.TZ = 'utc';

		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				created_on: datatypes.date( {
					initial: '2021-01-21'
				} )
			}
		} );

		const user = User.create();

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_date_utc_serialization'
		} );

		await users.put( user );

		const stored_user = await users.get( user.id );

		assert.deepStrictEqual( stored_user, user );

		await users.close();

		process.env.TZ = PREV_TZ;
	} );

	group.test( 'should serialize/deserialize an ISODate properly', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored_user, user );

		await users.close();
	} );

	group.test( 'should serialize/deserialize an ISODate in UTC properly', async () => {

		const PREV_TZ = process.env.TZ;
		process.env.TZ = 'utc';

		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored_user, user );

		await users.close();

		process.env.TZ = PREV_TZ;
	} );

	group.test( 'should determine integer types properly', async () => {
		const Smallint = model( {
			name: 'smallint_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
		assert.match( smallint_table_create_sql, /val SMALLINT/ );

		const Integer = model( {
			name: 'integer_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
		assert.match( integer_table_create_sql, /val INTEGER/ );

		const Bigint = model( {
			name: 'bigint_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer( {
					range: {
						min: -100000000000000n,
						max: 100000000000000n
					}
				} )
			}
		} );

		const bigints = await databases.postgres.get( Bigint, {
			db,
			table: 'bigint_test_store'
		} );

		const bigint_table_create_sql = bigints._create_table_sql();
		assert.match( bigint_table_create_sql, /val BIGINT/ );

		const Unspecified = model( {
			name: 'unspecified_range_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
		assert.match( unspecified_table_create_sql, /val INTEGER/ );
	} );

	group.test( 'should serialize/deserialize integers properly', async () => {
		const Smallint = model( {
			name: 'smallint_serialization_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
			table: 'smallint_serialization_test_store'
		} );

		const smallint = Smallint.create( {
			val: 123
		} );

		await smallints.put( smallint );

		const stored_smallint = await smallints.get( smallint.id );

		await smallints.close();

		assert.strictEqual( stored_smallint.val, 123 );

		const Integer = model( {
			name: 'integer_serialization_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
			table: 'integer_serialization_test_store'
		} );

		const integer = Integer.create( {
			val: 10123
		} );

		await integers.put( integer );

		const stored_integer = await integers.get( integer.id );

		await integers.close();

		assert.strictEqual( stored_integer.val, 10123 );

		const Bigint = model( {
			name: 'bigint_serialization_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer( {
					range: {
						min: -100000000000000n,
						max: 100000000000000n
					}
				} )
			}
		} );

		const bigints = await databases.postgres.get( Bigint, {
			db,
			table: 'bigint_serialization_test_store'
		} );

		const bigint = Bigint.create( {
			val: -90000000000123n
		} );

		await bigints.put( bigint );

		const stored_bigint = await bigints.get( bigint.id );

		await bigints.close();

		assert.strictEqual( stored_bigint.val, -90000000000123n );

		const Unspecified = model( {
			name: 'unspecified_range_serialization_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer()
			}
		} );

		const unspecifieds = await databases.postgres.get( Unspecified, {
			db,
			table: 'unspecified_serialization_test_store'
		} );

		const unspecified = Unspecified.create( {
			val: 123123123
		} );

		await unspecifieds.put( unspecified );

		const stored_unspecified = await unspecifieds.get( unspecified.id );

		await unspecifieds.close();

		assert.strictEqual( stored_unspecified.val, 123123123 );
	} );

	group.test( 'should serialize/deserialize a JSON object properly', async () => {
		const JSONObject = model( {
			name: 'jsonobject',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored.val, {
			foo: 'bar'
		} );

		await jsonobjects.close();
	} );

	group.test( 'should serialize/deserialize a JSON array properly', async () => {
		const JSONArray = model( {
			name: 'jsonarray',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored.val, [ 1, 2, 3 ] );

		await jsonarrays.close();
	} );

	group.test( 'should serialize/deserialize a boolean properly', async () => {
		const TestModel = model( {
			name: 'boolean_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored, test );

		await tests.close();
	} );

	group.test( 'should serialize/deserialize a number properly', async () => {
		const TestModel = model( {
			name: 'number_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored, test );

		await tests.close();
	} );

	group.test( 'should support column_type_overrides', async () => {
		const Model = model( {
			name: 'testoverrides',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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
		assert.match( table_create_sql, /foo TEXT/ );

		const test = Model.create( {
			foo: {
				blah: true
			}
		} );

		await instances.put( test );

		const stored = await instances.get( test.id );

		assert.deepStrictEqual( stored, test );

		await instances.close();
	} );

	group.test( 'should support async serialize/deserialize', async () => {
		const Model = model( {
			name: 'testasyncserialization',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
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

		assert.deepStrictEqual( stored, test );

		await instances.close();
	} );

	group.test( 'should support where()', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				email: datatypes.email( {
					initial: null
				} ),
				quote: datatypes.string(),
				tags: datatypes.JSON( {
					initial: []
				} ),
				created_at: datatypes.ISODate()
			}
		} );

		const users = await databases.postgres.get( User, {
			db,
			table: 'users_direct_query'
		} );

		const created_users = [];
		for ( let index = 0; index < 5; ++index ) {
			const user = User.create( {
				email: `users_direct_query${ index }@domain.com`,
				quote: `this is quote ${ index }`,
				tags: [ 'one', 'two', 'three', 'four', 'five' ].slice( 0, index + 1 )
			} );

			created_users.push( user );

			await users.put( user );
		}

		const users_with_quote_0 = await users.where( {
			query: 'quote = \'this is quote 0\''
		} );
		assert.strictEqual( Array.isArray( users_with_quote_0 ), true );
		assert.strictEqual( Array.isArray( users_with_quote_0 ) && users_with_quote_0.length, 1 );

		const all_users = await users.where( {
			query: 'quote LIKE $1',
			values: [ 'this is quote%' ]
		} );
		assert.strictEqual( Array.isArray( all_users ), true );
		assert.strictEqual( Array.isArray( all_users ) && all_users.length, 5 );

		const has_three_tag_users = await users.where( {
			query: 'tags ? $1',
			values: [ 'three' ]
		} );
		assert.strictEqual( Array.isArray( has_three_tag_users ), true );
		assert.strictEqual( Array.isArray( has_three_tag_users ) && has_three_tag_users.length, 3 );

		const limited_users = await users.where( {
			query: 'email IS NOT NULL',
			options: {
				limit: 2
			}
		} );
		assert.strictEqual( Array.isArray( limited_users ), true );
		assert.strictEqual( Array.isArray( limited_users ) && limited_users.length, 2 );

		const offset_users = await users.where( {
			query: 'email IS NOT NULL',
			options: {
				offset: 2
			}
		} );
		assert.strictEqual( Array.isArray( offset_users ), true );
		assert.strictEqual( Array.isArray( offset_users ) && offset_users.length, 3 );

		const ascending_created_users = [ ...created_users ].sort( ( lhs, rhs ) => lhs.email.localeCompare( rhs.email ) );
		const sorted_users = await users.where( {
			query: 'email IS NOT NULL',
			options: {
				order: {
					column: 'email',
					sort: 'asc'
				}
			}
		} );
		assert.strictEqual( Array.isArray( sorted_users ), true );
		assert.strictEqual( Array.isArray( sorted_users ) && sorted_users.length, 5 );
		assert.deepStrictEqual( sorted_users, ascending_created_users );

		await users.close();
	} );

	group.test( 'should allow querying json fields with .where()', async () => {
		const JSONObject = model( {
			name: 'jsonobject',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.JSON( {
					initial: {}
				} )
			}
		} );

		const jsonobjects = await databases.postgres.get( JSONObject, {
			db,
			table: 'jsonobjects_where',
			debug: false
		} );

		for ( let i = 0; i < 10; ++i ) {
			const jsonobject = JSONObject.create( {
				val: {
					i
				}
			} );
	
			await jsonobjects.put( jsonobject );
		}

		const found = await jsonobjects.where( {
			query: '( val->>\'i\' )::integer >= 5'
		} );

		assert.strictEqual( Array.isArray( found ), true );
		assert.strictEqual( found?.length, 5 );

		await jsonobjects.close();
	} );

	group.test( 'should allow locking', async () => {
		const TestModel = model( {
			name: 'lock_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				value: datatypes.number()
			}
		} );

		const tests = await databases.postgres.get( TestModel, {
			db,
			table: 'locking'
		} );

		const locked = await tests.try_lock( 1 );

		assert.strictEqual( locked, true );

		const other_tests_connection = await databases.postgres.get( TestModel, {
			db,
			table: 'locking'
		} );

		const second_lock = await other_tests_connection.try_lock( 1 );

		assert.strictEqual( second_lock, false );

		const unlocked = await tests.unlock( 1 );

		assert.strictEqual( unlocked, true );

		const third_lock = await other_tests_connection.try_lock( 1 );

		assert.strictEqual( third_lock, true );

		const fourth_lock = await tests.try_lock( 1 );

		assert.strictEqual( fourth_lock, false );

		const third_lock_unlocked = await other_tests_connection.unlock( 1 );

		assert.strictEqual( third_lock_unlocked, true );

		await tests.close();
		await other_tests_connection.close();
	} );

	group.test( 'should allow locking with two lock arguments', async () => {
		const TestModel = model( {
			name: 'lock_second_argument_test',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				value: datatypes.number()
			}
		} );

		const tests = await databases.postgres.get( TestModel, {
			db,
			table: 'locking_second_argument_test'
		} );

		const locked = await tests.try_lock( 1, 2 );

		assert.strictEqual( locked, true );

		const other_tests_connection = await databases.postgres.get( TestModel, {
			db,
			table: 'locking_second_argument_test'
		} );

		const second_lock = await other_tests_connection.try_lock( 1, 2 );

		assert.strictEqual( second_lock, false );

		const unlocked = await tests.unlock( 1, 2 );

		assert.strictEqual( unlocked, true );

		const third_lock = await other_tests_connection.try_lock( 1, 2 );

		assert.strictEqual( third_lock, true );

		const fourth_lock = await tests.try_lock( 1, 2 );

		assert.strictEqual( fourth_lock, false );

		const third_lock_unlocked = await other_tests_connection.unlock( 1, 2 );

		assert.strictEqual( third_lock_unlocked, true );

		await assert.rejects( async () => {
			await tests.try_lock( 1, 2, 3 );
		}, {
			name: 'Error',
			message: 'invalid number of arguments to try_lock()'
		} );

		await assert.rejects( async () => {
			await tests.unlock( 1, 2, 3 );
		}, {
			name: 'Error',
			message: 'invalid number of arguments to unlock()'
		} );

		await tests.close();
		await other_tests_connection.close();
	} );

	group.test( 'should allow basic indexing', async () => {
		const Indexed = model( {
			name: 'indexed',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer( {
					initial: 123,
					index: true
				} )
			}
		} );

		const test_db = await databases.postgres.get( Indexed, {
			db,
			table: 'basic_indexing_test'
		} );

		const index_sql_queries = test_db._index_sql_queries();
		assert.ok( Array.isArray( index_sql_queries ) );
		assert.strictEqual( index_sql_queries?.length, 1 );

		const test = Indexed.create( {
			val: 456
		} );
		assert.strictEqual( test.val, 456 );

		await test_db.put( test );

		const found = await test_db.find( {
			val: 456
		} );
		assert.ok( found );
		assert.strictEqual( found.val, 456 );

		const index_exists_results = await test_db.query( 'SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = \'basic_indexing_test_val_index\'' );
		assert.ok( Array.isArray( index_exists_results?.rows ) );

		const result = ( Array.isArray( index_exists_results?.rows ) ? index_exists_results.rows : [] ).shift();
		assert.ok( result );

		const value = Object.values( result ?? {} ).shift();
		assert.strictEqual( value, 1 );

		await test_db.close();
	} );

	group.test( 'should allow passing params to .query()', async () => {
		const Queryable = model( {
			name: 'query_params',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				val: datatypes.integer( {
					initial: 123,
					index: true
				} )
			}
		} );

		const test_db = await databases.postgres.get( Queryable, {
			db,
			table: 'query_params_test'
		} );

		const test = Queryable.create( {
			val: 456
		} );
		assert.strictEqual( test.val, 456 );

		await test_db.put( test );

		const found = await test_db.find( {
			val: 456
		} );
		assert.ok( found );
		assert.strictEqual( found.val, 456 );

		const query_without_params_result = await test_db.query( 'SELECT count(*) from query_params_test;' );
		assert.ok( query_without_params_result );
		assert.ok( Array.isArray( query_without_params_result?.rows ) );
		const no_params_result = ( Array.isArray( query_without_params_result?.rows ) ? query_without_params_result.rows : [] ).shift();
		assert.strictEqual( no_params_result?.count, '1' );

		const query_with_params_result = await test_db.query( 'SELECT count(*) from query_params_test where val = $1;', [ 123 ] );
		assert.ok( query_with_params_result );
		assert.ok( Array.isArray( query_with_params_result?.rows ) );
		const wrong_value_result = ( Array.isArray( query_with_params_result?.rows ) ? query_with_params_result.rows : [] ).shift();
		assert.strictEqual( wrong_value_result?.count, '0' );

		const correct_query_with_params_result = await test_db.query( 'SELECT count(*) from query_params_test where val = $1 and id = $2;', [ 456, test.id ] );
		assert.ok( correct_query_with_params_result );
		assert.ok( Array.isArray( correct_query_with_params_result?.rows ) );
		const correct_value_result = ( Array.isArray( correct_query_with_params_result?.rows ) ? correct_query_with_params_result.rows : [] ).shift();
		assert.strictEqual( correct_value_result?.count, '1' );

		await test_db.close();
	} );

	group.test( 'should allow processing matching objects', async () => {
		const User = model( {
			name: 'user',
			schema: {
				id: datatypes.UUID( {
					nullable: false,
					unique: true,
					primary: true
				} ),
				should_be_processed: datatypes.boolean( {
					initial: () => ( Math.random() > 0.5 )
				} ),
				processed: datatypes.boolean( {
					initial: false
				} )
			}
		} );

		const users = await databases.postgres.get( User, {
			db,
			table: 'processing'
		} );

		for ( let i = 0; i < 250; ++i ) {
			const user = User.create( {} );
			await users.put( user );
		}

		await users.process( {
			should_be_processed: true
		}, async ( user ) => {
			user.processed = true;
			await users.put( user );
		} );

		const users_that_should_have_been_processed = await users.all( {
			should_be_processed: true
		}, {
			limit: 250
		} );

		const all_users_that_should_have_been_processed_were_processed = users_that_should_have_been_processed.every( ( user ) => ( user.processed ) );
		assert.strictEqual( all_users_that_should_have_been_processed_were_processed, true );

		const users_that_should_not_have_been_processed = await users.all( {
			should_be_processed: false
		}, {
			limit: 250
		} );

		const all_users_that_should_not_have_been_processed_were_not_processed = users_that_should_not_have_been_processed.every( ( user ) => ( !user.processed ) );
		assert.strictEqual( all_users_that_should_not_have_been_processed_were_not_processed, true );

		await users.close();
	} );
};
