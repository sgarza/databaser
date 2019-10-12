'use strict';

const extend = require( 'extend' );

module.exports = _options => {
    const options = extend( true, {
        null: true,
        length: {
            min: undefined,
            max: undefined
        },
        unique: false,
        initial: undefined,
        validate: undefined
    }, _options );

    return {
        datatype: 'string',
        options,
        initial: () => {
            if ( typeof options.initial !== 'undefined' ) {
                return typeof options.initial === 'function' ? options.initial() : options.initial;
            }

            return undefined;
        },
        validate: value => {
            if ( !options.null && value === null ) {
                return 'null value not allowed';
            }
            else if ( options.null && value === null ) {
                return;
            }

            if ( typeof value !== 'string' ) {
                return 'invalid type';
            }

            if ( options.length.min && value.length < options.length.min ) {
                return 'too short';
            }

            if ( options.length.max && value.length > options.length.max ) {
                return 'too long';
            }

            if ( typeof options.validate === 'function' ) {
                const error = options.validate( value );
                if ( error ) {
                    return error;
                }
            }

            return;
        }
    };
};