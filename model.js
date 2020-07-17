'use strict';

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

            const object = extend( true, {}, initial_object, _object );
            return object;
        },

        validate: object => {
            const errors = [];

            const object_traverser = traverse( object );

            traverse( options.schema ).forEach( function( value ) {
                if ( typeof value === 'object' && !!value && value.datatype ) {
                    const input_value = object_traverser.get( this.path );
                    const error = value.validate( input_value );
                    if ( error ) {
                        errors.push( error );
                    }
                }
            } );

            return errors;
        }
    };
};