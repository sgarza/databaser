'use strict';

const delver = require( 'delver' );
const extend = require( 'extend' );
const traverse = require( 'traverse' );

module.exports = _options => {
    const options = extend( true, {}, _options );

    if ( !options.name ) {
        throw new Error( 'You must specify a name to create a model.' );
    }

    if ( !options.schema ) {
        throw new Error( 'You must specify a schema to create a model.' );
    }

    return {
        options,

        create: _object => {
            const initial_object = traverse( options.schema ).map( function( value ) {
                if ( typeof value === 'object' && value.datatype ) {
                    if ( typeof value.initial === 'function' ) {
                        this.update( value.initial(), true );
                    }
                    else if ( typeof value.initial !== 'undefined' ) {
                        this.update( value.initial, true );
                    }
                    else {
                        this.update( undefined, true );
                    }
                    return;
                }

                this.update( value );
            } );

            const object = extend( true, initial_object, _object );
            return object;
        },

        validate: object => {
            const errors = [];
            traverse( options.schema ).forEach( function( value ) {
                if ( typeof value === 'object' && !!value && value.datatype ) {
                    const key = this.path.join( '.' );
                    const input_value = delver.get( object, key );
                    const error = value.validate( input_value );
                    if ( error ) {
                        errors.push( {
                            key,
                            error
                        } );
                    }
                }
            } );

            return errors.length ? errors : null;
        }
    };
};