'use strict';

const dates = require( 'date-fns' );
const extend = require( 'extend' );
const pg = require( 'pg' );
const pluralize = require( 'pluralize' );
const traverse = require( 'traverse' );

const DATATYPE_MAP = {
	email: ( field ) => ( field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT' ),

	// NOTE: we store enums as strings in postgres for a few reasons:
	//   - there's no trivial CREATE TYPE ... IF NOT EXISTS
	//   - if you modify the values allowed in the enum, we would need to do a lot of altering, and might not know
	//	 exactly how that should be handled
	//   - there's disagreement about doing this altering since it cannot happen in a transaction
	// so we will just store it as TEXT for now
	enum: () => ( 'TEXT' ),

	integer: ( field ) => {
		const RANGES = {
			'SMALLINT': [ -32768, 32767 ],
			'INTEGER': [ -2147483648, 2147483647 ],
			'BIGINT': [ -9223372036854775808, 9223372036854775807 ]
		};

		let storage_type = 'INTEGER';

		if ( typeof field.options.range.min === 'number' || typeof field.options.range.max === 'number' ) {
			for ( const type of Object.keys( RANGES ) ) {
				const range = RANGES[ type ];
				if ( typeof field.options.range.min === 'number' && field.options.range.min < range[ 0 ] ) {
					continue;
				}
				else if ( typeof field.options.range.max === 'number' && field.options.range.max > range[ 1 ] ) {
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
	ISODate: ( value ) => ( value ? new Date( value ).toISOString() : value ),

	// no need for JSON deserializer, postgres automatically deserializes
	number: ( value ) => ( typeof value === 'string' ? Number( value ) : value )
};

const PG_POOL = {
	create: ( _options ) => {

		const defaults = {
			debug: false,
			db: {
				host: process.env.POSTGRES_HOST || 'localhost',
				port: process.env.POSTGRES_PORT || '5432',
				user: process.env.POSTGRES_USER || 'postgres',
				password: process.env.POSTGRES_PASSWORD,
				database: process.env.POSTGRES_DATABASE || 'postgres'
			}
		};

		if ( process.env.POSTGRES_CACERT ) {
			defaults.db.ssl = {
				ca: process.env.POSTGRES_CACERT
			};
		}
		
		const options = extend( true, defaults, _options );

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
	get: ( model, _options ) => {
		const options = extend( true, {
			debug: false,
			table: pluralize( model.options.name ),
			column_type_overrides: {},
			serializers: {},
			deserializers: {},
			column_name: ( path ) => ( path.join( '__' ) ),
			primary_key: null
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
					if ( typeof field === 'object' && !!field && field.datatype ) {
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
						column.options.null === false ? 'NOT NULL' : null
					].filter( ( value ) => ( !!value ) );
					return `${ key } ${ column.type }${ modifiers.length ? ` ${ modifiers.join( ' ' ) }` : '' }`;
				} );

				return `CREATE TABLE IF NOT EXISTS ${ options.table } (${ clauses.join( ', ' ) });`;
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
					if ( typeof field === 'object' && !!field && field.datatype ) {
						const key = options.column_name( path );
						const value = object_traverser.get( path );
						const serializer = options.serializers[ key ] || DATATYPE_SERIALIZERS[ field.datatype ];
						const serialized_value = serializer ? await serializer( value ) : value;
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
					if ( typeof field === 'object' && !!field && field.datatype ) {
						const key = options.column_name( path );
						const value = object_traverser.get( [ key ] );
						const deserializer = options.deserializers[ key ] || DATATYPE_DESERIALIZERS[ field.datatype ];
						const deserialized_value = deserializer ? await deserializer( value ) : value;
						deserialized_traverser.set( path, deserialized_value );
					}
				}

				return model.create( deserialized );
			},

			get connected() {
				return this._pool.connected;
			},

			query: async function( query ) {
				await this._init();
				const pool = await this._pool.get();
				const result = await pool.query( query );
				return result;
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

			find: async function( criteria, _find_options ) {
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

							if ( Array.isArray( value ) ) {
								const or_clauses = [];
								for ( let i = 0; i < value.length; ++i ) {
									or_clauses.push( `${ column_name } = $${ values.length + 1 }` );
									const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
									const serialized_value = serializer ? await serializer( value[ i ] ) : value[ i ];
									values.push( serialized_value );
								}
								clauses.push( `( ${ or_clauses.join( ' OR ' ) } )` );
							}
							else {
								clauses.push( `${ column_name } = $${ values.length + 1 }` );
								const serializer = options.serializers[ column_name ] || DATATYPE_SERIALIZERS[ field.datatype ];
								const serialized_value = serializer ? await serializer( value ) : value;
								values.push( serialized_value );
							}
						}
					}
				}

				const find_options = extend( true, {
					limit: 10,
					offset: 0,
					order: {
						column: null,
						sort: 'desc'
					}
				}, _find_options );
	
				const ordering = typeof find_options.order.column === 'string' ? `ORDER BY ${ find_options.order.column } ${ find_options.order.sort }` : '';

				const query = [
					`SELECT * FROM ${ options.table } ${ clauses.length ? `WHERE ${ clauses.join( ' AND ' ) }` : '' }`,
					ordering,
					`LIMIT ${ find_options.limit }`,
					`OFFSET ${ find_options.offset }`
				].join( ' ' );

				if ( options.debug ) {
					console.log( query );
					console.log( values );
				}

				const pool = await this._pool.get();
				const result = await pool.query( query, values );
				const results = [];
				for ( const row of result.rows ) {
					results.push( await this._deserialize( row ) );
				}
				return results;
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
			}
		};

		return db;
	}
};