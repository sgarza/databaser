'use strict';

const extend = require( 'extend' );
const uuid = require( 'uuid' );

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = _options => {
    const options = extend( true, {
        null: true,
        unique: false,
        initial: undefined
    }, _options );

    return {
        datatype: 'UUID',
        options,
        initial: () => {
            if ( typeof options.initial !== 'undefined' ) {
                return typeof options.initial === 'function' ? options.initial() : options.initial;
            }

            return uuid.v4();
        },
        validate: value => {
            if ( !options.null && value === null ) {
                return {
                    error: 'null value not allowed'
                };
            }
            else if ( options.null && value === null ) {
                return;
            }

            return value !== null && !UUID_REGEX.test( value ) ? 'invalid value format' : undefined;
        }
    };
};