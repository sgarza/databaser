'use strict';

const extend = require( 'extend' );

module.exports = _options => {
    const options = extend( true, {
        null: true,
        unique: false,
        range: {
            min: undefined,
            max: undefined
        },
        initial: undefined
    }, _options );

    return {
        datatype: 'integer',
        options,
        initial: () => {
            if ( typeof options.initial !== 'undefined' ) {
                return typeof options.initial === 'function' ? options.initial() : options.initial;
            }

            return undefined;
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

            if ( typeof value !== 'number' ) {
                return {
                    error: 'invalid type'
                };
            }

            if ( options.range.min && value < options.range.min ) {
                return {
                    error: 'value below minumum'
                };
            }

            if ( options.range.max && value > options.range.max ) {
                return {
                    error: 'value above maximum'
                };
            }

            return;
        }
    };
};