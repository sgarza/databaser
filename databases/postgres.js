'use strict';

const dates = require( 'date-fns' );
const deepmerge = require( 'deepmerge' );
const pg = require( 'pg' );
const pluralize = require( 'pluralize' );
const traverse = require( 'traverse' );

const PROCESS_BATCH_SIZE = 100;

// TODO: remove this if https://github.com/brianc/node-postgres/issues/1789 is fixed
const RETRYABLE_ERROR_CODES = {
	'ECONNREFUSED': true, // connection refused
	'ECONNRESET': true,
	'57P03': true, // cannot_connect_now
	'Error: Connection terminated unexpectedly': true
};
pg.Pool.prototype._connect_original = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = function ( callback ) {
	this.__retries = this.__retries ?? 0;
	const max_retries = this.options.retries ?? 10;

	try {
		this._connect_original( ( error, client ) => {
			if ( error && RETRYABLE_ERROR_CODES[ error.code ?? error ] && this.__retries < max_retries ) {
				console.warn( `Error connecting to Postgres, retrying... (${ this.__retries + 1 })` );
				this.__retries++;
				setTimeout( this.connect.bind( this, callback ), 1000 );
				return;
			}
			else if ( error ) {
				console.warn( `Unhandled DB error: ${ error?.code ?? error.toString() }` );
			}
			callback( error, client );
		} );
	} catch ( ex ) {
		const ex_as_string = ex.toString();
		if ( ex_as_string.includes( 'ECONNREFUSED' ) && this.__retries < max_retries ) {
			console.warn( `Error connecting to Postgres, retrying... (${ this.__retries + 1 })` );
			this.__retries++;
			setTimeout( this.connect.bind( this, callback ), 1000 );
		} else {
			console.warn( `Unhandled DB exception: ${ ex_as_string }` );
			throw ex;
		}
	}
};

// TODO: do we need to sanitize ordering columns, ordering sorts, limits and offets?

const DATATYPE_MAP = {
	boolean: () => ( 'BOOLEAN' ),

	date: () => ( 'DATE' ),

	email: ( field ) => ( field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT' ),

	// NOTE: we store enums as strings in postgres for a few reasons:
	//   - there's no trivial CREATE TYPE ... IF NOT EXISTS
	//   - if you modify the values allowed in the enum, we would need to do a lot of altering, and might not know
	//     exactly how that should be handled
	//   - there's disagreement about doing this altering since it cannot happen in a transaction
	//     so we will just store it as TEXT for now
	enum: () => ( 'TEXT' ),

	integer: ( field ) => {
		const RANGES = {
			'SMALLINT': [ -32768, 32767 ],
			'INTEGER': [ -2147483648, 2147483647 ],
			'BIGINT': [ -9223372036854775808n, 9223372036854775807n ]
		};

		let storage_type = 'INTEGER';

		if ( typeof field.options.range.min !== 'undefined' || typeof field.options.range.max !== 'undefined' ) {
			for ( const type of Object.keys( RANGES ) ) {
				const range = RANGES[ type ];
				if ( typeof field.options.range.min !== 'undefined' && field.options.range.min < range[ 0 ] ) {
					continue;
				}
				else if ( typeof field.options.range.max !== 'undefined' && field.options.range.max > range[ 1 ] ) {
					continue;
				}
				else {
					storage_type = type;
					break;
				}
			}
		}

		return storage_type;
	},

	ISODate: () => ( 'TIMESTAMPTZ' ),

	JSON: () => ( 'JSONB' ),

	number: () => ( 'NUMERIC' ),

	phone: ( field ) => ( field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT' ),

	string: ( field ) => ( field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT' ),

	UUID: () => ( 'UUID' )
};

const DATATYPE_SERIALIZERS = {
	ISODate: ( value ) => ( value ? dates.format( new Date( value ), 'yyyy-MM-dd HH:mm:ss.SSSSSX' ) : value ),

	JSON: ( value ) => ( value ? JSON.stringify( value ) : value )
};

const DATATYPE_DESERIALIZERS = {
	date: ( value ) => ( value ? dates.format( new Date( value ), 'yyyy-MM-dd' ) : value ),

	integer: ( value, field ) => {
		const storage_type = DATATYPE_MAP.integer( field );

		if ( storage_type === 'BIGINT' ) {
			return BigInt( value );
		}
		else {
			return typeof value === 'string' ? Number( value ) : value;
		}
	},

	ISODate: ( value ) => ( value ? new Date( value ).toISOString() : value ),

	// no need for JSON deserializer, postgres automatically deserializes
	number: ( value ) => ( typeof value === 'string' ? Number( value ) : value )
};

const PG_POOL = {
	create: ( _options = {} ) => {

		const defaults = {
			debug: false,
			db: {
				host: process.env.POSTGRES_HOST || 'localhost',
				port: process.env.POSTGRES_PORT || '5432',
				user: process.env.POSTGRES_USER || 'postgres',
				password: process.env.POSTGRES_PASSWORD,
				database: process.env.POSTGRES_DATABASE || 'postgres',
				connectionTimeoutMillis: 1000 * 10
			}
		};

		if ( process.env.POSTGRES_CACERT ) {
			defaults.db.ssl = {
				ca: process.env.POSTGRES_CACERT
			};
		}
		
		const options = deepmerge( defaults, _options );

		return {
			connected: false,
			get: async function() {
				if ( this._pool ) {
					return this._pool;
				}

				this._pool = new pg.Pool( options.db );

				if ( options.debug ) {
					console.log( `Postgres pool created [ ${ options.db.user }@${ options.db.host }:${ options.db.port } SSL: ${ !!options.db.ssl } db: ${ options.db.database } ]` );
				} 

				this.connected = true;

				this._pool.on( 'error', async ( error ) => {
					console.error( `Unexpected postgres pool error: ${ error }` );
					const __pool = this._pool;
					this._pool = null;
					await __pool.end();
					this.connected = false;
					console.error( '  Terminated pool.' );
				} );
			
				return this._pool;
			}
		};
	}
};

module.exports = {
	get: ( model, _options = {} ) => {
		const options = deepmerge( {
			debug: false,
			table: pluralize( model.options.name ),
			column_type_overrides: {},
			serializers: {},
			deserializers: {},
			column_name: ( path ) => ( path.join( '__' ) ),
			primary_key: null,
			concurrent_indexing: false,
			max: process.env.POSTGRES_MAX_CLIENTS || 50
		}, _options );

		if ( !options.primary_key ) {
			options.primary_key = traverse( model.options.schema ).reduce( function( _primary_key, node ) {
				if ( _primary_key ) {
					return _primary_key;
				}

				if ( !!node && !!node.options && !!node.options.primary ) {
					return options.column_name( this.path );
				}
			}, null );
		}

		if ( !options.primary_key ) {
			throw new Error( `No primary key for model: ${ model.options.name }` );
		}

		const db = {
			options,
			_pool: options.pool || PG_POOL.create( options ),

			_create_table_sql: function() {
				const columns = {};
				traverse( model.options.schema ).forEach( function( field ) {
					if ( typeof field === 'object' && !!field && field.datatype && field.options.stored !== false ) {
						const key = options.column_name( this.path );
						const mapper = DATATYPE_MAP[ field.datatype ];
						if ( !mapper ) {
							throw new Error( `Unknown datatype: ${ field.datatype }` );
						}
		
						columns[ key ] = {
							type: options.column_type_overrides[ key ] ? options.column_type_overrides[ key ] : mapper( field ),
							options: field.options
						};
						return;
					}
				} );
			
				const clauses = Object.keys( columns ).map( ( key ) => {
					const column = columns[ key ];
					const modifiers = [
						column.options.unique ? 'UNIQUE' : null,
						column.options.primary ? 'PRIMARY KEY' : null,
						column.options.nullable === false ? 'NOT NULL' : null
					].filter( ( value ) => ( !!value ) );
					return `${ key } ${ column.type }${ modifiers.length ? ` ${ modifiers.join( ' ' ) }` : '' }`;
				} );

				return `CREATE TABLE IF NOT EXISTS ${ options.table } (${ clauses.join( ', ' ) });`;
			},

			_index_sql_queries: function() {
				const columns_to_index = [];
				traverse( model.options.schema ).forEach( function( field ) {
					if ( typeof field === 'object' && !!field && field.datatype && field.options.stored !== false && field.options.index ) {
						const key = options.column_name( this.path );
						columns_to_index.push( key );
					}
				} );
			
				return columns_to_index.map( ( key ) => ( `CREATE INDEX ${ options.concurrent_indexing ? 'CONCURRENTLY' : '' } IF NOT EXISTS ${ `${ options.table }_${ key }_index` } ON ${ options.table } ( ${ key } );` ) );
			},

			_init: async function() {
				if ( this._initialized ) {
					return;
				}

				if ( this._initializing ) {
					return new Promise( ( resolve, reject ) => {
						let retry_count = 0;
						const check = () => {
							if ( this._initialized ) {
								resolve( this );
							}
							else {
								retry_count++ < 100 ? setTimeout( check, 100 ) : reject( new Error( {
									error: `timed out initializing postgres db driver for model: ${ model.options.name }`
								} ) );
							}
						};
						check();
					} );
				}

				this._initializing = true;

				const query = this._create_table_sql();

				if ( options.debug ) {
					console.log( query );
				}

				const pool = await this._pool.get();
				await pool.query( query );

				const index_queries = this._index_sql_queries();
				for ( const index_query of index_queries ) {
					if ( options.debug ) {
						console.log( index_query );
					}

					await pool.query( index_query );
				}

				this._initialized = true;
				this._initializing = false;
			},

			_serialize: async function( object ) {
				const serialized = {};

				const schema_traverser = traverse( model.options.schema );
				const object_traverser = traverse( object );
				const serialized_traverser = traverse( serialized );

				const schema_paths = schema_traverser.paths();
				for ( const path of schema_paths ) {
					const field = schema_traverser.get( path );
					if ( typeof field === 'object' && !!field && field.datatype && field.options.stored !== false ) {
						const key = options.column_name( path );
						const value = object_traverser.get( path );
						const serializer = options.serializers[ key ] || DATATYPE_SERIALIZERS[ field.datatype ];
						const serialized_value = serializer ? await serializer( value, field ) : value;
						serialized_traverser.set( [ key ], serialized_value );
					}
				}

				return serialized;
			},

			_deserialize: async function( object ) {
				if ( !object ) {
					return object;
				}

				const deserialized = {};

				const schema_traverser = traverse( model.options.schema );
				const object_traverser = traverse( object );
				const deserialized_traverser = traverse( deserialized );

				const schema_paths = schema_traverser.paths();
				for ( const path of schema_paths ) {
					const field = schema_traverser.get( path );
					if ( typeof field === 'object' && !!field && field.datatype && field.options.stored !== false ) {
						const key = options.column_name( path );
						const value = object_traverser.get( [ key ] );
						const deserializer = options.deserializers[ key ] || DATATYPE_DESERIALIZERS[ field.datatype ];
						const deserialized_value = deserializer ? await deserializer( value, field ) : value;
						deserialized_traverser.set( path, deserialized_value );
					}
				}

				return model.create( deserialized );
			},

			get connected() {
				return this._pool.connected;
			},

			query: async function( query, values = [] ) {
				await this._init();
				const pool = await this._pool.get();
				if ( options.debug ) {
					console.log( `query: ${ query }\n values: ${ values }` );
				}
				const result = await pool.query( query, values );
				return result;
			},

			where: async function( _options = {} ) {
				await this._init();
				const pool = await this._pool.get();

				const find_options = deepmerge( {
					limit: 10,
					offset: 0,
					order: {
						column: null,
						sort: 'desc'
					}
				}, _options.options ?? {} );

				const values = _options.values ?? [];

				const ordering = find_options.order.column !== null ? `ORDER BY ${ Array.isArray( find_options.order.column ) ? options.column_name( find_options.order.column ) : find_options.order.column } ${ find_options.order.sort }` : '';

				const query = [
					`SELECT * FROM ${ options.table } WHERE ${ _options.query }`,
					ordering,
					`LIMIT $${ values.length + 1 }`,
					`OFFSET $${ values.length + 2 }`
				].join( ' ' );

				const result = await pool.query( query, values.concat( [ find_options.limit, find_options.offset ] ) );

				const results = [];
				for ( const row of result.rows ) {
					results.push( await this._deserialize( row ) );
				}
				return results;
			},

			get: async function( key ) {
				await this._init();

				const pool = await this._pool.get();
				const result = await pool.query( {
					name: `fetch-${ model.options.name }`,
					text: `SELECT * FROM ${ options.table } WHERE ${ options.primary_key } = $1`,
					values: [ key ]
				} );

				if ( options.debug ) {
					console.log( `SELECT * FROM ${ options.table } WHERE ${ options.primary_key } = $1` );
					console.log( [ key ] );
				}

				const found = result.rows.shift();
				return await this._deserialize( found );
			},

			put: async function( object ) {
				await this._init();

				const serialized = await this._serialize( object );
				const sorted_fields = Object.keys( serialized ).sort();
				let query = `INSERT
					INTO ${ options.table } (${ sorted_fields })
					VALUES(${ sorted_fields.map( ( field, index ) => `$${ index + 1 }` ).join( ', ' ) })`;

				const on_conflict_statements = sorted_fields.map( ( field, index ) => ( field === options.primary_key ? '' : `${ field } = $${ index + 1 }` ) ).filter( ( statement ) => statement.length );

				if ( on_conflict_statements.length ) {
					query += `
					ON CONFLICT(${ options.primary_key })
						DO UPDATE SET
							${ sorted_fields.map( ( field, index ) => ( field === options.primary_key ? '' : `${ field } = $${ index + 1 }` ) ).filter( ( statement ) => statement.length ).join( ', ' ) }`;
				}

				const values = sorted_fields.map( ( field ) => ( serialized[ field ] ) );

				if ( options.debug ) {
					console.log( query );
					console.log( values );
				}

				const pool = await this._pool.get();
				const result = await pool.query( query, values );
				const inserted = result.rows.shift();
				return inserted;
			},

			del: async function( key ) {
				await this._init();

				const query = `DELETE FROM ${ options.table } WHERE ${ options.primary_key } = $1`;

				if ( options.debug ) {
					console.log( query );
				}

				const pool = await this._pool.get();
				const result = await pool.query( query, [ key ] );
				const deleted = result.rows.shift();
				return deleted;
			},

			find: async function( criteria, _options = {} ) {
				const query_options = deepmerge( _options, {
					limit: 1
				} );
				const results = await this.all( criteria, query_options );
				return results.shift();
			},

			all: async function( criteria, _options = {} ) {
				await this._init();

				const clauses = [];
				const values = [];

				const schema_traverser = traverse( model.options.schema );
				const criteria_traverser = traverse( criteria );

				const schema_paths = schema_traverser.paths();
				for ( const path of schema_paths ) {
					const field = schema_traverser.get( path );
					if ( typeof field === 'object' && !!field && field.datatype ) {
						const input = criteria_traverser.get( path );
						if ( typeof input !== 'undefined' ) {
							const column_name = options.column_name( path );
							const value = criteria_traverser.get( path );
							const mapper = DATATYPE_MAP[ field.datatype ];
							if ( !mapper ) {
								throw new Error( `Unknown datatype: ${ field.datatype }` );
							}

							if ( Array.isArray( value ) ) {
								const types = value.reduce( ( _types, _value ) => {
									_types[ typeof _value ] = true;
									return _types;
								}, {} );

								if ( Object.keys( types ).length !== 1 ) {
									throw new Error( 'mixed types passed in array comparator' );
								}

								clauses.push( `${ column_name } = ANY ( $${ values.length + 1 } )` );
								values.push( value );
							}
							else if ( typeof value === 'object' && value !== null ) {
								if ( value.and ) {
									const and_clauses = [];
									for ( let i = 0; i < value.and.length; ++i ) {
										const clause = value.and[ i ];
										and_clauses.push( `${ column_name } ${ clause.comparison ?? '=' } $${ values.length + 1 }` );
										const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
										const serialized_value = serializer ? await serializer( value.and[ i ].value ) : value.and[ i ].value;
										values.push( serialized_value );
									}
									clauses.push( `( ${ and_clauses.join( ' AND ' ) } )` );
								}

								if ( value.or ) {
									const or_clauses = [];
									for ( let i = 0; i < value.or.length; ++i ) {
										const clause = value.or[ i ];
										or_clauses.push( `${ column_name } ${ clause.comparison ?? '=' } $${ values.length + 1 }` );
										const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
										const serialized_value = serializer ? await serializer( value.or[ i ].value ) : value.or[ i ].value;
										values.push( serialized_value );
									}
									clauses.push( `( ${ or_clauses.join( ' OR ' ) } )` );
								}
								
								if ( value.comparison ) {
									clauses.push( `${ column_name } ${ value.comparison } $${ values.length + 1 }` );
									const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
									const serialized_value = serializer ? await serializer( value.value ) : value.value;
									values.push( serialized_value );
								}

								if ( typeof value.not !== 'undefined' ) {
									if ( value.not === null ) {
										clauses.push( `${ column_name } IS NOT NULL` );
									}
									else {
										const nots = Array.isArray( value.not ) ? value.not : [ value.not ];
										
										if ( nots.includes( null ) ) {
											throw new Error( 'cannot include null in array of values with not' );
										}

										clauses.push( `${ column_name } <> ALL ( $${ values.length + 1 } )` );
										values.push( nots );
									}
								}
							}
							else {
								const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
								const serialized_value = serializer ? await serializer( value ) : value;

								clauses.push( `${ column_name } ${ serialized_value === null ? 'IS NULL' : `= $${ values.length + 1 }` }` );

								if ( serialized_value !== null ) {
									values.push( serialized_value );
								}
							}
						}
					}
				}

				const query_options = deepmerge( {
					limit: 10,
					offset: 0,
					order: {
						column: null,
						sort: 'desc'
					}
				}, _options );

				const ordering = query_options.order.column !== null ? `ORDER BY ${ Array.isArray( query_options.order.column ) ? options.column_name( query_options.order.column ) : query_options.order.column } ${ query_options.order.sort }` : '';
				const filtered_values = values.filter( ( value ) => ( value !== null ) );

				const query = [
					`SELECT * FROM ${ options.table } ${ clauses.length ? `WHERE ${ clauses.join( ' AND ' ) }` : '' }`,
					ordering,
					`LIMIT $${ filtered_values.length + 1 }`,
					`OFFSET $${ filtered_values.length + 2 }`
				].join( ' ' );

				if ( options.debug ) {
					console.log( query );
					console.log( filtered_values );
				}

				const pool = await this._pool.get();
				const result = await pool.query( query, filtered_values.concat( [ query_options.limit, query_options.offset ] ) );
				const results = [];
				for ( const row of result.rows ) {
					results.push( await this._deserialize( row ) );
				}
				return results;
			},

			process: async function( criteria, process ) {
				let offset = 0;
				let results;
				do {
					results = await this.all( criteria, {
						limit: PROCESS_BATCH_SIZE,
						offset,
						order: {
							column: options.primary_key,
							sort: 'asc'
						}
					} );

					offset += results.length;

					for ( const result of results ) {
						await process( result );
					}
				} while( results?.length === PROCESS_BATCH_SIZE );
			},

			open: async function() {
				await this._init();
			},

			close: async function() {
				if ( this._pool ) {
					const pool = await this._pool.get();
					await pool.end();
					this._pool.connected = false;
				}
			},

			try_lock: async function() {
				const pool = await this._pool.get();

				if ( arguments.length === 1 ) {
					const result = await pool.query( 'SELECT pg_try_advisory_lock( $1 )', [ ...arguments ] );
					const row = result?.rows?.[ 0 ] ?? {
						pg_try_advisory_lock: false
					};
	
					return row.pg_try_advisory_lock;
				}
				else if ( arguments.length === 2 ) {
					const result = await pool.query( 'SELECT pg_try_advisory_lock( $1, $2 )', [ ...arguments ] );
					const row = result?.rows?.[ 0 ] ?? {
						pg_try_advisory_lock: false
					};
	
					return row.pg_try_advisory_lock;
				}
				else {
					throw new Error( 'invalid number of arguments to try_lock()' );
				}
			},

			unlock: async function() {
				const pool = await this._pool.get();

				if ( arguments.length === 1 ) {
					const result = await pool.query( 'SELECT pg_advisory_unlock( $1 )', [ ...arguments ] );
					const row = result?.rows?.[ 0 ] ?? {
						pg_advisory_unlock: false
					};
	
					return row.pg_advisory_unlock;
				}
				else if ( arguments.length === 2 ) {
					const result = await pool.query( 'SELECT pg_advisory_unlock( $1, $2 )', [ ...arguments ] );
					const row = result?.rows?.[ 0 ] ?? {
						pg_advisory_unlock: false
					};
	
					return row.pg_advisory_unlock;
				}
				else {
					throw new Error( 'invalid number of arguments to unlock()' );
				}
			}
		};

		return db;
	}
};