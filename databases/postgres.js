'use strict';

const extend = require( 'extend' );
const pg = require( 'pg' );
const pluralize = require( 'pluralize' );
const traverse = require( 'traverse' );

const DATATYPE_MAP = {
    email: field => {
        return field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT';
    },
    ISODate: () => {
        return 'TIMESTAMPTZ';
    },
    json: () => {
        return 'JSONB';
    },
    phone: field => {
        return field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT';
    },
    string: field => {
        return field.options.length.max ? `VARCHAR(${ field.options.length.max })` : 'TEXT';
    },
    UUID: () => {
        return 'UUID';
    }
};

const PG_POOL = {
    create: _options => {

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
            get: async function() {
                if ( this._pool ) {
                    return this._pool;
                }
            
                this._pool = new pg.Pool( options.db );

                if ( options.debug ) {
                    console.log( `Postgres pool created [ ${ options.db.user }@${ options.db.host }:${ options.db.port } SSL: ${ !!options.db.ssl } db: ${ options.db.database } ]` );
                } 

                this._pool.on( 'error', async error => {
                    console.error( `Unexpected postgres pool error: ${ error }` );
                    const __pool = this._pool;
                    this._pool = null;
                    await __pool.end();
                    console.error( '  Terminated pool.' );
                } );
            
                return this._pool;
            }
        };
    }
};

module.exports = {
    get: async ( model, _options ) => {
        const options = extend( true, {
            debug: false,
            table: pluralize( model.options.name ),
            serializers: {},
            deserializers: {},
            column_name: path => {
                return path.join( '__' );
            },
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
            throw new Error( `No primary key for model: ${ model.name }` );
        }

        const db = {
            options,
            _pool: options.pool || PG_POOL.create( options ),
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
                                    error: `timed out initializing postgres db driver for model: ${ model.name }`
                                } ) );
                            }
                        };
                        check();
                    } );
                }

                this._initializing = true;

                const columns = {};
                traverse( model.options.schema ).forEach( function( field ) {
                    if ( typeof field === 'object' && !!field && field.datatype ) {
                        const key = options.column_name( this.path );
                        const mapper = DATATYPE_MAP[ field.datatype ];
                        if ( !mapper ) {
                            throw new Error( `Unknown datatype: ${ field.datatype }` );
                        }
        
                        columns[ key ] = {
                            type: mapper( field ),
                            options: field.options
                        };
                        return;
                    }
                } );
            
                const clauses = Object.keys( columns ).map( key => {
                    const column = columns[ key ];
                    const modifiers = [
                        column.options.unique ? 'UNIQUE' : null,
                        column.options.primary ? 'PRIMARY KEY' : null,
                        column.options.null === false ? 'NOT NULL' : null
                    ].filter( value => !!value );
                    return `${ key } ${ column.type }${ modifiers.length ? ` ${ modifiers.join( ' ' ) }` : '' }`;
                } );

                const query = `CREATE TABLE IF NOT EXISTS ${ options.table } (${ clauses.join( ', ' ) });`;

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

                schema_traverser.forEach( function( field ) {
                    if ( typeof field === 'object' && !!field && field.datatype ) {
                        const key = options.column_name( this.path );
                        const value = object_traverser.get( this.path );
                        const serialized_value = options.serializers[ key ] ? options.serializers[ key ]( value ) : field.serialize ? field.serialize( value ) : value;
                        serialized_traverser.set( [ key ], serialized_value );
                        return;
                    }
                } );

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

                schema_traverser.forEach( function( field ) {
                    if ( typeof field === 'object' && !!field && field.datatype ) {
                        const key = options.column_name( this.path );
                        const value = object_traverser.get( [ key ] );
                        const deserialized_value = options.deserializers[ key ] ? options.deserializers[ key ]( value ) : field.deserialize ? field.deserialize( value ) : value;
                        deserialized_traverser.set( this.path, deserialized_value );
                        return;
                    }
                } );

                return model.create( deserialized );
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
                    name: `fetch-${ model.name }`,
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
                const query = `INSERT
                    INTO ${ options.table } (${ sorted_fields })
                    VALUES(${ sorted_fields.map( ( field, index ) => `$${ index + 1 }` ).join( ', ' ) })
                    ON CONFLICT(${ options.primary_key })
                        DO UPDATE SET
                            ${ sorted_fields.map( ( field, index ) => field === options.primary_key ? '' : `${ field } = $${ index + 1 }` ).filter( statement => statement.length ).join( ', ' ) }`;

                if ( options.debug ) {
                    console.log( query );
                }

                const pool = await this._pool.get();
                const result = await pool.query( query, sorted_fields.map( field => serialized[ field ] ) );
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

                schema_traverser.forEach( function( field ) {
                    if ( typeof field === 'object' && !!field && field.datatype ) {
                        const input = criteria_traverser.get( this.path );
                        if ( typeof input !== 'undefined' ) {
                            const column_name = options.column_name( this.path );
                            clauses.push( `${ column_name } = $${ values.length + 1 }` );

                            const value = criteria_traverser.get( this.path );
                            const serialized_value = options.serializers[ column_name ] ? options.serializers[ column_name ]( value ) : field.serialize ? field.serialize( value ) : value;
                            values.push( serialized_value );
                        }
                        return;
                    }
                } );

                const find_options = extend( true, {
                    limit: 10,
                    offset: 0,
                    order: {
                        column: null,
                        sort: 'desc'
                    }
                }, _find_options );
    
                const ordering = typeof find_options.order.column_name === 'string' ? `ORDER BY ${ find_options.order.column } ${ find_options.order.sort }` : '';

                const query = [
                    `SELECT * FROM ${ options.table } ${ clauses.length ? `WHERE ${ clauses.join( ' AND ' ) }` : '' }`,
                    ordering,
                    `LIMIT ${ find_options.limit }`,
                    `OFFSET ${ find_options.offset }`
                ].join( ' ' );

                if ( options.debug ) {
                    console.log( query );
                }

                const pool = await this._pool.get();
                const result = await pool.query( query, values );
                const results = [];
                for ( const row of result.rows ) {
                    results.push( await this._deserialize( row ) );
                }
                return results;
            },

            close: async function() {
                if ( this._pool ) {
                    const pool = await this._pool.get();
                    return pool.end();
                }
            }
        };

        await db._init();
        return db;
    }
};