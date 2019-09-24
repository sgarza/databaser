'use strict';

const extend = require( 'extend' );

module.exports = _options => {
    const options = extend( true, {
        null: true,
        initial: undefined
    }, _options );

    return {
        datatype: 'ISODate',
        options,
        initial: () => {
            if ( typeof options.initial !== 'undefined' ) {
                return typeof options.initial === 'function' ? options.initial() : options.initial;
            }

            return new Date().toISOString();
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

            if ( typeof value !== 'string' ) {
                return {
                    error: 'invalid type'
                };
            }

            return value !== null && !/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/.test( value ) ? {
                error: 'invalid value format'
            } : undefined;
        }
    };
};