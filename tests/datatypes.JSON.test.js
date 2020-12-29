'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.JSON' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.JSON, 'function' );

		const obj = datatypes.JSON();

		assert.strictEqual( obj?.datatype, 'JSON' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			initial: undefined,
			validate: undefined,
			example: {
				foo: 'bar'
			}
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.JSON( {
					validate: ( value ) => {
						if ( !value.valid ) {
							return 'not valid';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: {
				valid: true,
				foo: true
			}
		} );

		const bad = Validation.create( {
			val: {
				valid: false,
				foo: false
			}
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'not valid'
		} ] );
	} );
};