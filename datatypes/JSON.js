'use strict';

const extend = require( 'extend' );

module.exports = _options => {
    const options = extend( true, {
        null: true,
        initial: undefined
    }, _options );

    return {
        datatype: 'JSON',
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

            try {
                JSON.stringify( value );
                return undefined;
            }
            catch( ex ) {
                return 'invalid value format';
            }
        },
        serialize: value => {
            return JSON.stringify( value );
        },
        deserialize: value => {
            return JSON.parse( value );
        }
    };
};